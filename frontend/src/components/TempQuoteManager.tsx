import React, { useState, useEffect } from 'react';
import { fetchTempQuotes, deleteTempQuote, clearTempQuotes } from '../services/api';

interface TempQuote {
  id: string;
  issue_code: string;
  issue_name: string;
  issue_date: string;
  tenor: string;
  ref_yield: string;
  volume: string;
  rating: string;
  price: string;
  bank_name: string;
}

interface Props {
  onQuoteDeleted?: () => void;
}

export const TempQuoteManager: React.FC<Props> = ({ onQuoteDeleted }) => {
  const [quotes, setQuotes] = useState<TempQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<'bank_name' | 'issue_code' | 'issue_name'>('bank_name');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  // 加载临时报价
  const loadQuotes = async () => {
    setLoading(true);
    try {
      const res = await fetchTempQuotes();
      setQuotes(res.data || []);
    } catch (error) {
      console.error('加载临时报价失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, []);

  // 搜索过滤
  const filteredQuotes = quotes.filter(quote => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return quote[searchField]?.toLowerCase().includes(term);
  });

  // 切换选择
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuotes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuotes.map(q => q.id)));
    }
  };

  // 删除选中项
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const confirmMsg = `确定要删除选中的 ${selectedIds.size} 条报价吗？`;
    if (!window.confirm(confirmMsg)) return;

    try {
      for (const id of selectedIds) {
        await deleteTempQuote(id);
      }
      await loadQuotes();
      setSelectedIds(new Set());
      onQuoteDeleted?.();
      alert(`已删除 ${selectedIds.size} 条报价`);
    } catch (error) {
      alert(`删除失败：${error}`);
    }
  };

  // 清空所有
  const handleClearAll = async () => {
    if (quotes.length === 0) return;

    if (!window.confirm(`确定要清空所有 ${quotes.length} 条临时报价吗？`)) return;

    try {
      await clearTempQuotes();
      await loadQuotes();
      setSelectedIds(new Set());
      onQuoteDeleted?.();
      alert('已清空所有临时报价');
    } catch (error) {
      alert(`清空失败：${error}`);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span> 临时报价管理
        </h2>
        <div className="text-sm text-slate-500">
          共 {quotes.length} 条
        </div>
      </div>

      {/* 搜索栏 */}
      <div className="flex gap-2 mb-4">
        <select
          value={searchField}
          onChange={(e) => setSearchField(e.target.value as any)}
          className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl font-bold text-slate-600"
        >
          <option value="bank_name">银行名称</option>
          <option value="issue_code">存单代码</option>
          <option value="issue_name">存单简称</option>
        </select>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="搜索..."
          className="flex-1 text-xs bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl outline-none focus:border-amber-200"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            清除
          </button>
        )}
      </div>

      {/* 批量操作栏 */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
          <span className="text-sm font-bold text-amber-700">
            已选中 {selectedIds.size} 条
          </span>
          <button
            onClick={handleDeleteSelected}
            className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600"
          >
            删除选中
          </button>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={loadQuotes}
          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200"
        >
          刷新
        </button>
        <button
          onClick={handleClearAll}
          disabled={quotes.length === 0}
          className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-200 disabled:opacity-50"
        >
          清空全部
        </button>
      </div>

      {/* 报价表格 */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          {searchTerm ? '未找到匹配的报价' : '暂无临时报价'}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredQuotes.length && filteredQuotes.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                </th>
                <th className="text-left py-3 px-4 font-bold text-slate-500">存单代码</th>
                <th className="text-left py-3 px-4 font-bold text-slate-500">存单简称</th>
                <th className="text-left py-3 px-4 font-bold text-slate-500">银行</th>
                <th className="text-left py-3 px-4 font-bold text-slate-500">期限</th>
                <th className="text-left py-3 px-4 font-bold text-slate-500">价格</th>
                <th className="text-left py-3 px-4 font-bold text-slate-500">收益率</th>
                <th className="text-left py-3 px-4 font-bold text-slate-500">发行日期</th>
                <th className="text-left py-3 px-4 font-bold text-slate-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => (
                <tr
                  key={quote.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 ${
                    selectedIds.has(quote.id) ? 'bg-amber-50' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(quote.id)}
                      onChange={() => toggleSelect(quote.id)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono">{quote.issue_code || '-'}</td>
                  <td className="py-3 px-4 font-bold">{quote.issue_name || '-'}</td>
                  <td className="py-3 px-4">{quote.bank_name || '-'}</td>
                  <td className="py-3 px-4">{quote.tenor || '-'}</td>
                  <td className="py-3 px-4 font-bold text-indigo-600">{quote.price || '-'}</td>
                  <td className="py-3 px-4">{quote.ref_yield || '-'}</td>
                  <td className="py-3 px-4">{quote.issue_date || '-'}</td>
                  <td className="py-3 px-4">
                    <button
                      onClick={async () => {
                        if (!window.confirm('确定删除此报价？')) return;
                        await deleteTempQuote(quote.id);
                        await loadQuotes();
                        setSelectedIds(new Set(selectedIds).delete(quote.id) as Set<string>);
                        onQuoteDeleted?.();
                      }}
                      className="text-red-500 hover:text-red-600 text-xs font-bold"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 提示信息 */}
      <p className="text-xs text-slate-400 mt-4">
        💡 提示：搜索支持按银行名称、存单代码或存单简称筛选，勾选后可批量删除
      </p>
    </div>
  );
};
