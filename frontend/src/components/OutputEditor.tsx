import React, { useState } from 'react';
import { ParsedLine } from '../utils/parser';

interface Props {
  items: ParsedLine[];
  issueDate: string;
}

export const OutputEditor: React.FC<Props> = ({ items, issueDate }) => {
  const [order, setOrder] = useState<number[]>(items.map((_, i) => i));
  const [selected, setSelected] = useState<number[]>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [outputFormat, setOutputFormat] = useState<'default' | 'compact'>('default');

  // 计算发行日期 +2 个工作日（简化版，直接 +2 天）
  const calculateSettlementDate = (dateStr: string) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + 2);
    return date.toISOString().split('T')[0];
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

  const handleCopy = () => {
    const output = order.map((idx) => {
      const item = items[idx];
      const settlementDate = calculateSettlementDate(issueDate);
      const parts = [
        item.bankName || '',
        item.rating || '',
        item.weekday || '',
        item.tenor || '',
        item.yield || '',
        item.volume ? `${item.volume} +` : ''
      ].filter(Boolean).join(' ');
      return parts;
    }).join('\n');

    navigator.clipboard.writeText(output);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleRenumber = () => {
    // 重新编号功能：选中项按顺序编号 1,2,3
    const sortedSelected = [...selected].sort((a, b) => {
      return order.indexOf(a) - order.indexOf(b);
    });

    console.log('选中项编号:', sortedSelected.map((i, idx) => `${items[i].bankName}: ${idx + 1}`));
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
          <button
            onClick={handleRenumber}
            disabled={selected.length === 0}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg font-bold disabled:opacity-50"
          >
            重新编号 ({selected.length})
          </button>
          <button
            onClick={handleCopy}
            className={`px-4 py-1.5 text-xs rounded-lg font-bold transition-all ${
              copyFeedback ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {copyFeedback ? '✓ 已复制' : '复制'}
          </button>
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
          const settlementDate = calculateSettlementDate(issueDate);

          return (
            <div
              key={originalIndex}
              className={`p-3 rounded-xl border flex items-center gap-2 ${
                isSelected ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'
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
                {outputFormat === 'default' ? (
                  <div className="flex flex-wrap gap-3">
                    <span className="font-bold text-slate-800">{item.bankName || '-'}</span>
                    <span className="text-slate-500">{item.rating || '-'}</span>
                    <span className="text-slate-500">{item.weekday || '-'}</span>
                    <span className="text-indigo-600 font-bold">{item.tenor || '-'}</span>
                    <span className="text-emerald-600 font-bold">{item.yield || '-'}</span>
                    <span className="text-slate-400">{item.volume ? `${item.volume} +` : '-'}</span>
                    <span className="text-xs text-slate-400">起息：{settlementDate}</span>
                  </div>
                ) : (
                  <div className="text-slate-700">
                    {item.bankName} {item.rating} {item.weekday} {item.tenor} {item.yield} {item.volume && `${item.volume}+`}
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
        💡 提示：勾选项目后点击"重新编号"可按顺序编号 1,2,3... 点击"复制"输出最终格式
      </p>
    </section>
  );
};
