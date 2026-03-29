import React, { useState, useEffect, useRef } from 'react';
import { ParsedLine } from '../utils/parser';

interface Props {
  items: ParsedLine[];
  issueDate: string;
  onRematch?: () => void;  // 重新匹配回调
}

export const OutputEditor: React.FC<Props> = ({ items, issueDate }) => {
  const [order, setOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'default' | 'compact'>('default');
  const [settlementOffset, setSettlementOffset] = useState(3);  // 默认 T+3 工作日
  const [customSettlementDate, setCustomSettlementDate] = useState('');

  // 使用 ref 追踪最新的 items
  const itemsRef = useRef<ParsedLine[]>(items);
  itemsRef.current = items;

  // 当 items 变化时，只在 order 为空或长度不匹配时更新
  useEffect(() => {
    setOrder(prev => {
      if (prev.length === 0 || prev.length !== items.length) {
        return items.map((_, i) => i);
      }
      return prev;
    });
  }, [items]);

  // 计算交割日期（发行日期 + T+2 工作日）
  const calculateSettlementDate = (dateStr: string) => {
    const date = new Date(dateStr || issueDate);
    let daysAdded = 0;
    while (daysAdded < 2) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) {
        daysAdded++;
      }
    }
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}.${day}+0`;
  };

  // 格式化收益率：去掉末尾 0，保留至少 2 位小数，添加%
  const formatYield = (yieldVal: string | undefined) => {
    if (!yieldVal) return '-';
    const num = parseFloat(yieldVal);
    if (isNaN(num)) return yieldVal;
    // 保留 4 位小数，去掉末尾 0，至少保留 2 位小数
    let formatted = num.toFixed(4).replace(/0+$/, '');
    if (formatted.includes('.')) {
      const [intPart, decPart] = formatted.split('.');
      if (decPart && decPart.length < 2) {
        formatted = num.toFixed(2);
      } else if (!decPart) {
        formatted = intPart;
      }
    }
    return `${formatted}%`;
  };

  // 批量设置交割日期偏移
  const handleSetOffset = (offset: number) => {
    setSettlementOffset(offset);
    setCustomSettlementDate('');
  };

  // 批量设置自定义交割日期
  const handleSetCustomDate = (date: string) => {
    setCustomSettlementDate(date);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;
    setOrder(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    setOrder(newOrder);
  };

  const handleSelect = (index: number) => {
    if (selected.includes(index)) {
      setSelected(selected.filter(i => i !== index));
    } else {
      setSelected([...selected, index]);
    }
  };

  const handleCopy = (withNumber = false) => {
    // 只复制选中的项，如果没有选中则复制全部
    const indicesToCopy = selected.length > 0 ? selected : order;

    const output = indicesToCopy.map((originalIndex, i) => {
      const item = items[originalIndex];
      // 使用 issueDate 计算交割日期（发行日期 + T+2 工作日）
      const issueDateStr = item.issueDate || issueDate;
      const dateObj = new Date(issueDateStr);
      // T+2：发行日 + 2 个工作日（跳过周末）
      let daysAdded = 0;
      while (daysAdded < 2) {
        dateObj.setDate(dateObj.getDate() + 1);
        const day = dateObj.getDay();
        if (day !== 0 && day !== 6) {
          daysAdded++;
        }
      }
      // 格式化为 MM.DD+0
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const settlementStr = `${month}.${day}+0`;

      // 如果匹配到了完整数据（有代码和简称），输出标准化格式
      if (item.issueCode && item.issueName) {
        // 标准化格式：代码 代码简称 期限 收益率 净价 [量] 交割日期
        const yieldStr = formatYield(item.yield || item.refYield);
        const volumeStr = item.volume ? ` ${item.volume}` : '';
        const numberPrefix = withNumber ? `${i + 1}. ` : '';
        return `${numberPrefix}${item.issueCode} ${item.issueName} ${item.tenor} ${yieldStr} ${item.price || '-'}${volumeStr} ${settlementStr}`;
      }

      // 原始格式
      const parts = [
        item.bankName || '',
        item.rating || '',
        item.weekday || '',
        item.tenor || '',
        item.yield || '',
        item.volume ? `${item.volume} +` : ''
      ].filter(Boolean).join(' ');
      const numberPrefix = withNumber ? `${i + 1}. ` : '';
      return `${numberPrefix}${parts}`;
    }).join('\n');

    // 降级方案：navigator.clipboard 在非 HTTPS 环境可能不可用
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(output);
    } else {
      // 传统复制方法
      const textarea = document.createElement('textarea');
      textarea.value = output;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDeleteSelected = () => {
    if (selected.length === 0) return;

    if (!window.confirm(`确定要删除选中的 ${selected.length} 条数据吗？`)) return;

    // 删除选中的数据
    const newOrder = order.filter((_, idx) => !selected.includes(idx));
    setOrder(newOrder);
    setSelected([]);

    // 同时更新父组件的 items
    const newItems = items.filter((_, idx) => !selected.includes(idx));
    itemsRef.current = newItems;
  };

  const handleRenumber = () => {
    // 重新编号功能：选中项按顺序编号 1,2,3
    const sortedSelected = [...selected].sort((a, b) => {
      return order.indexOf(a) - order.indexOf(b);
    });

    alert(`已选中 ${sortedSelected.length} 项，编号 1-${sortedSelected.length}`);
  };

  const sortedSelected = [...selected].sort((a, b) => {
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 输出编辑
        </h2>
        <div className="flex gap-2">
          {onRematch && (
            <button
              onClick={onRematch}
              className="px-3 py-1.5 text-xs bg-indigo-100 text-indigo-600 rounded-lg font-bold hover:bg-indigo-200"
            >
              重新匹配
            </button>
          )}
          <button
            onClick={handleDeleteSelected}
            disabled={selected.length === 0}
            className="px-3 py-1.5 text-xs bg-red-100 text-red-600 rounded-lg font-bold disabled:opacity-50"
          >
            删除选中 ({selected.length})
          </button>
          <button
            onClick={handleRenumber}
            disabled={selected.length === 0}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg font-bold disabled:opacity-50"
          >
            重新编号 ({selected.length})
          </button>
          <button
            onClick={() => handleCopy(false)}
            className={`px-4 py-1.5 text-xs rounded-lg font-bold transition-all ${
              copyFeedback ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {copyFeedback ? '✓ 已复制' : '复制选中'}
          </button>
          <button
            onClick={() => handleCopy(true)}
            className={`px-4 py-1.5 text-xs rounded-lg font-bold transition-all ${
              copyFeedback ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {copyFeedback ? '✓ 已复制' : '带编号复制'}
          </button>
        </div>
      </div>

      {/* 交割日期批量修改 */}
      <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs font-bold text-slate-600">交割日期:</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleSetOffset(0)}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                settlementOffset === 0 && !customSettlementDate ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              T+0
            </button>
            <button
              onClick={() => handleSetOffset(1)}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                settlementOffset === 1 && !customSettlementDate ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              T+1
            </button>
            <button
              onClick={() => handleSetOffset(2)}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                settlementOffset === 2 && !customSettlementDate ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              T+2
            </button>
            <button
              onClick={() => handleSetOffset(3)}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                settlementOffset === 3 && !customSettlementDate ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              T+3
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">自定义:</span>
            <input
              type="date"
              value={customSettlementDate}
              onChange={(e) => handleSetCustomDate(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded px-2 py-1"
            />
            {customSettlementDate && (
              <button
                onClick={() => { setCustomSettlementDate(''); setSettlementOffset(2); }}
                className="text-xs text-red-500 hover:text-red-600"
              >
                清除
              </button>
            )}
          </div>
          <span className="text-xs text-slate-400 ml-2">
            当前：{customSettlementDate || `T+${settlementOffset}`}
          </span>
        </div>
      </div>

      {/* 格式选择 */}
      <div className="flex gap-2 mb-4">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setOutputFormat('default')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              outputFormat === 'default' ? 'bg-white shadow text-slate-900' : 'text-slate-400'
            }`}
          >
            标准格式
          </button>
          <button
            onClick={() => setOutputFormat('compact')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              outputFormat === 'compact' ? 'bg-white shadow text-slate-900' : 'text-slate-400'
            }`}
          >
            紧凑格式
          </button>
        </div>
      </div>

      {/* 输出列表 */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {order.map((originalIndex, displayIndex) => {
          const item = items[originalIndex];
          const isSelected = selected.includes(originalIndex);
          const settlementDate = calculateSettlementDate(item.issueDate || issueDate);

          // 是否匹配到完整数据 - 只要 issueCode 和 issueName 有值即可
          const hasFullData = item.issueCode && item.issueName;

          return (
            <div
              key={originalIndex}
              className={`p-3 rounded-xl border flex items-center gap-2 ${
                isSelected ? 'border-indigo-300 bg-indigo-50' : hasFullData ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              {/* 序号和选择框 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleSelect(originalIndex)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-xs font-bold text-slate-400 w-4">
                  {sortedSelected.indexOf(originalIndex) + 1}
                </span>
              </div>

              {/* 内容 */}
              <div className="flex-1 font-mono text-sm">
                {hasFullData ? (
                  // 匹配到完整数据的显示 - 输出格式：代码 代码简称 期限 收益率 净价 [量] 交割日期
                  <div className="flex flex-wrap gap-3 items-center">
                    <span className="font-bold text-emerald-600">✓</span>
                    <span className="font-bold text-slate-800">{item.issueCode}</span>
                    <span className="text-slate-700">{item.issueName}</span>
                    <span className="text-indigo-600 font-bold">{item.tenor}</span>
                    <span className="text-emerald-600 font-bold">{formatYield(item.refYield || item.yield)}</span>
                    <span className="text-slate-500">{item.price || '-'}</span>
                    {item.volume && (
                      <span className="text-slate-400 font-bold">{item.volume}</span>
                    )}
                    <span className="text-xs text-slate-400">交割：{settlementDate}</span>
                  </div>
                ) : (
                  // 未匹配到完整数据的显示
                  <div className="flex flex-wrap gap-3">
                    <span className="font-bold text-slate-800">{item.bankName || '-'}</span>
                    <span className="text-slate-500">{item.rating || '-'}</span>
                    <span className="text-slate-500">{item.weekday || '-'}</span>
                    <span className="text-indigo-600 font-bold">{item.tenor || '-'}</span>
                    <span className="text-emerald-600 font-bold">{formatYield(item.yield)}</span>
                    {item.volume && (
                      <span className="text-slate-400 font-bold">{item.volume}</span>
                    )}
                    <span className="text-xs text-slate-400">交割：{settlementDate}</span>
                  </div>
                )}
              </div>

              {/* 移动按钮 */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleMoveUp(displayIndex)}
                  disabled={displayIndex === 0}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded disabled:opacity-30"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveDown(displayIndex)}
                  disabled={displayIndex === order.length - 1}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded disabled:opacity-30"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="text-center text-slate-300 py-12">
            暂无数据，请先解析输入
          </div>
        )}
      </div>

      {/* 提示信息 */}
      <p className="text-xs text-slate-400 mt-4">
        💡 提示：匹配到数据会显示 ✓ 和完整要素，点击"复制"输出标准格式（代码 简称 期限 收益率 价格 交割日）
      </p>
    </section>
  );
};
