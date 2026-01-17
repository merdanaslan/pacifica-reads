import { PositionHistoryItem, GroupedTrade, GroupedPosition, FillEvent } from './types.js';

export class TradeGrouper {

  /**
   * Groups raw fill events by order_id into trades
   */
  groupByOrder(fills: PositionHistoryItem[]): GroupedTrade[] {
    // Sort by created_at to ensure chronological order
    const sorted = [...fills].sort((a, b) => a.created_at - b.created_at);

    // Group by order_id (or history_id if order_id missing)
    const orderGroups = new Map<string, PositionHistoryItem[]>();

    for (const fill of sorted) {
      const key = fill.order_id?.toString() || `single_${fill.history_id}`;
      if (!orderGroups.has(key)) {
        orderGroups.set(key, []);
      }
      orderGroups.get(key)!.push(fill);
    }

    // Convert each group to GroupedTrade
    const trades: GroupedTrade[] = [];
    for (const [orderId, groupedFills] of orderGroups) {
      trades.push(this.createGroupedTrade(orderId, groupedFills));
    }

    return trades;
  }

  /**
   * Aggregates multiple fills into a single trade
   */
  private createGroupedTrade(tradeId: string, fills: PositionHistoryItem[]): GroupedTrade {
    // Calculate weighted average price
    let totalValue = 0;
    let totalAmount = 0;
    let totalFee = 0;
    let totalPnl = 0;

    for (const fill of fills) {
      const amount = parseFloat(fill.amount);
      const price = parseFloat(fill.price);
      const fee = parseFloat(fill.fee || '0');
      const pnl = parseFloat(fill.pnl || '0');

      totalValue += amount * price;
      totalAmount += amount;
      totalFee += fee;
      totalPnl += pnl;
    }

    const avgPrice = totalAmount > 0 ? totalValue / totalAmount : 0;
    const first = fills[0];
    const last = fills[fills.length - 1];

    return {
      trade_id: tradeId,
      order_id: first.order_id,
      symbol: first.symbol,
      side: first.side,
      total_amount: totalAmount.toFixed(8),
      average_price: avgPrice.toFixed(6),
      total_value: totalValue.toFixed(2),
      total_fee: totalFee.toFixed(8),
      total_pnl: totalPnl.toFixed(6),
      entry_price: first.entry_price,
      first_fill_time: first.created_at,
      last_fill_time: last.created_at,
      first_fill_time_readable: first.created_at_readable,
      last_fill_time_readable: last.created_at_readable,
      fills: fills.map(f => this.toFillEvent(f)),
      fill_count: fills.length,
    };
  }

  /**
   * Converts PositionHistoryItem to FillEvent (extract relevant fields)
   */
  private toFillEvent(item: PositionHistoryItem): FillEvent {
    return {
      history_id: item.history_id,
      amount: item.amount,
      price: item.price,
      fee: item.fee,
      pnl: item.pnl,
      event_type: item.event_type,
      created_at: item.created_at,
      created_at_readable: item.created_at_readable,
      cause: item.cause,
    };
  }

  /**
   * Groups trades into complete positions (entry to exit)
   */
  groupByPosition(trades: GroupedTrade[]): GroupedPosition[] {
    // Sort trades chronologically
    const sorted = [...trades].sort((a, b) => a.first_fill_time - b.first_fill_time);

    const positions: GroupedPosition[] = [];
    const positionsBySymbol = new Map<string, {
      direction: 'long' | 'short';
      size: number;
      entryTrades: GroupedTrade[];
      exitTrades: GroupedTrade[];
      startTime: number;
    }>();

    for (const trade of sorted) {
      const symbol = trade.symbol;
      const side = trade.side;
      const amount = parseFloat(trade.total_amount);

      // Determine if this is opening or closing
      const isOpen = side.startsWith('open_');
      const isClose = side.startsWith('close_');
      const direction = (side.includes('long') ? 'long' : 'short') as 'long' | 'short';

      if (isOpen) {
        // Opening a position
        if (!positionsBySymbol.has(symbol)) {
          positionsBySymbol.set(symbol, {
            direction,
            size: 0,
            entryTrades: [],
            exitTrades: [],
            startTime: trade.first_fill_time,
          });
        }
        const pos = positionsBySymbol.get(symbol)!;
        pos.size += amount;
        pos.entryTrades.push(trade);

      } else if (isClose) {
        // Closing a position
        if (!positionsBySymbol.has(symbol)) {
          // Closing without open (data starts mid-position)
          // Create position with estimated start
          positionsBySymbol.set(symbol, {
            direction,
            size: amount,
            entryTrades: [],
            exitTrades: [],
            startTime: trade.first_fill_time,
          });
        }

        const pos = positionsBySymbol.get(symbol)!;
        pos.size -= amount;
        pos.exitTrades.push(trade);

        // Position fully closed?
        if (Math.abs(pos.size) < 0.0001) {
          // Create completed position
          const position = this.createGroupedPosition(
            symbol,
            pos.direction,
            pos.entryTrades,
            pos.exitTrades,
            pos.startTime,
            trade.last_fill_time
          );
          positions.push(position);

          // Remove from tracking
          positionsBySymbol.delete(symbol);
        }
      }
    }

    // Handle any unclosed positions
    for (const [symbol, pos] of positionsBySymbol) {
      const position = this.createGroupedPosition(
        symbol,
        pos.direction,
        pos.entryTrades,
        pos.exitTrades,
        pos.startTime,
        pos.exitTrades.length > 0 ? pos.exitTrades[pos.exitTrades.length - 1].last_fill_time : pos.startTime
      );
      position.status = 'open';
      positions.push(position);
    }

    return positions.sort((a, b) => b.opened_at - a.opened_at); // Most recent first
  }

  /**
   * Creates a complete position from entry and exit trades
   */
  private createGroupedPosition(
    symbol: string,
    direction: 'long' | 'short',
    entryTrades: GroupedTrade[],
    exitTrades: GroupedTrade[],
    openTime: number,
    closeTime: number
  ): GroupedPosition {
    const allTrades = [...entryTrades, ...exitTrades];

    // Calculate weighted average entry price
    let totalEntryValue = 0;
    let totalEntryAmount = 0;
    for (const trade of entryTrades) {
      const amount = parseFloat(trade.total_amount);
      const price = parseFloat(trade.average_price);
      totalEntryValue += amount * price;
      totalEntryAmount += amount;
    }
    const entryPrice = totalEntryAmount > 0 ? totalEntryValue / totalEntryAmount : 0;

    // Calculate weighted average exit price
    let totalExitValue = 0;
    let totalExitAmount = 0;
    for (const trade of exitTrades) {
      const amount = parseFloat(trade.total_amount);
      const price = parseFloat(trade.average_price);
      totalExitValue += amount * price;
      totalExitAmount += amount;
    }
    const exitPrice = totalExitAmount > 0 ? totalExitValue / totalExitAmount : 0;

    // Calculate totals
    let totalPnl = 0;
    let totalFees = 0;
    for (const trade of allTrades) {
      totalPnl += parseFloat(trade.total_pnl);
      totalFees += parseFloat(trade.total_fee);
    }

    // Position size is max of entry/exit amounts
    const positionSize = Math.max(totalEntryAmount, totalExitAmount);

    // Notional value (position size in USD)
    const notionalValue = positionSize * entryPrice;

    // PnL percentage
    const pnlPct = exitPrice > 0 && entryPrice > 0
      ? ((direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice) / entryPrice * 100)
      : 0;

    const durationHours = (closeTime - openTime) / (1000 * 60 * 60);

    const posId = `${symbol}_${direction}_${openTime}`;

    return {
      position_id: posId,
      symbol,
      direction,
      opened_at: openTime,
      closed_at: closeTime,
      opened_at_readable: new Date(openTime).toISOString(),
      closed_at_readable: new Date(closeTime).toISOString(),
      duration_hours: parseFloat(durationHours.toFixed(2)),
      entry_price: entryPrice.toFixed(6),
      exit_price: exitPrice > 0 ? exitPrice.toFixed(6) : 'N/A',
      position_size: positionSize.toFixed(8),
      notional_value: notionalValue.toFixed(2),
      total_pnl: totalPnl.toFixed(6),
      total_fees: totalFees.toFixed(8),
      pnl_percentage: exitPrice > 0 ? pnlPct.toFixed(2) : 'N/A',
      trades: allTrades,
      trade_count: allTrades.length,
      status: 'closed',
    };
  }
}
