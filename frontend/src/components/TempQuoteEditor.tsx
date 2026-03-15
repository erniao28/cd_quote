import React, { useState, useEffect } from 'react';
import {
  fetchTempQuotes,
  saveTempQuotes,
  deleteTempQuote,
  clearTempQuotes,
  confirmTempQuotes,
  exportTempExcel
} from '../services/api';

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
  targetDate: string;
  onClose: () => void;
}

export const TempQuoteEditor: React.FC<Props> = ({ targetDate, onClose }) => {
  const [quotes, setQuotes] = useState<TempQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 加载临时报价
  const loadTempQuotes = async () => {
    setLoading(true);
    try {
      const res = await fetchTempQuotes();
      setQuotes(res.data || []);
    } catch (error: any) {
      setMessage(`加载失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTempQuotes();
  }, []);

  // 保存临时报价
  const handleSave = async () => {
    setLoading(true);
    try {
      await saveTempQuotes(quotes);
      setMessage('保存成功！所有用户将看到最新数据');
    } catch (error: any) {
      setMessage(`保存失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 确认保存（转入正式表）
  const handleConfirm = async () => {
    if (!confirm('确认将临时报价保存到正式数据库？此操作不可逆。')) {
      return;
    }

    setLoading(true);
    try {
      const res = await confirmTempQuotes();
      setMessage(`确认成功！已保存 ${res.data.count} 条报价`);
      setQuotes([]);
    } catch (error: any) {
      setMessage(`确认失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 导出 Excel
  const handleExport = async () => {
    try {
      const blob = await exportTempExcel(targetDate);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cd_quote_temp_${targetDate}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`导出失败：${error.message}`);
    }
  };

  // 清空
  const handleClear = async () => {
    if (!confirm('确定清空所有临时报价？')) {
      return;
    }

    try {
      await clearTempQuotes();
      setQuotes([]);
      setMessage('已清空所有临时报价');
    } catch (error: any) {
      setMessage(`清空失败：${error.message}`);
    }
  };

  // 删除单条
  const handleDelete = async (id: string) => {
    try {
      await deleteTempQuote(id);
      setQuotes(quotes.filter(q => q.id !== id));
    } catch (error: any) {
      alert(`删除失败：${error.message}`);
    }
  };

  // 编辑单元格
  const handleChange = (id: string, field: keyof TempQuote, value: string) => {
    setQuotes(quotes.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  // 添加新行
  const handleAddRow = () => {
    const newQuote: TempQuote = {
      id: `new_${Date.now()}`,
      issue_code: '',
      issue_name: '',
      issue_date: targetDate,
      tenor: '',
      ref_yield: '',
      volume: '',
      rating: '',
      price: '',
      bank_name: ''
    };
    setQuotes([...quotes, newQuote]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-8 py-6 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">在线编辑报价</h2>
            <p className="text-sm text-slate-500 mt-1">
              所有用户共享同一份数据，只保留最新版本
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition"
          >
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 flex gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={loading || quotes.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            保存修改
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || quotes.length === 0}
            className="px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 disabled:opacity-50"
          >
            确认保存到正式库
          </button>
          <button
            onClick={handleExport}
            disabled={loading || quotes.length === 0}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-300 disabled:opacity-50"
          >
            导出 Excel
          </button>
          <button
            onClick={handleAddRow}
            disabled={loading}
            className="px-4 py-2 bg-orange-400 text-white rounded-xl font-bold text-sm hover:bg-orange-500 disabled:opacity-50"
          >
            添加一行
          </button>
          <button
            onClick={handleClear}
            disabled={loading || quotes.length === 0}
            className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 disabled:opacity-50"
          >
            清空全部
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className="px-8 py-3 bg-indigo-50 border-b border-indigo-100">
            <p className="text-sm text-indigo-600 font-bold">{message}</p>
          </div>
        )}

        {/* 表格 */}
        <div className="flex-1 overflow-auto p-8">
          {loading && quotes.length === 0 ? (
            <div className="text-center py-20 text-slate-400">加载中...</div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              暂无临时报价，请先从正式数据导入或手动添加
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">存单代码</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">存单简称</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">发行日期</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">期限</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">发行价格</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">参考收益率</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">计划发行量</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">评级</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-r border-slate-200">银行名称</th>
                    <th className="text-left py-3 px-3 font-bold text-slate-500 border-b border-slate-200">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-slate-50">
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.issue_code}
                          onChange={(e) => handleChange(quote.id, 'issue_code', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.issue_name}
                          onChange={(e) => handleChange(quote.id, 'issue_name', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.issue_date}
                          onChange={(e) => handleChange(quote.id, 'issue_date', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.tenor}
                          onChange={(e) => handleChange(quote.id, 'tenor', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.price}
                          onChange={(e) => handleChange(quote.id, 'price', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.ref_yield}
                          onChange={(e) => handleChange(quote.id, 'ref_yield', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.volume}
                          onChange={(e) => handleChange(quote.id, 'volume', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.rating}
                          onChange={(e) => handleChange(quote.id, 'rating', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-r border-slate-200">
                        <input
                          type="text"
                          value={quote.bank_name}
                          onChange={(e) => handleChange(quote.id, 'bank_name', e.target.value)}
                          className="w-full px-2 py-1 border-none outline-none focus:bg-yellow-50"
                        />
                      </td>
                      <td className="border-b border-slate-200">
                        <button
                          onClick={() => handleDelete(quote.id)}
                          className="px-3 py-1 text-red-500 hover:bg-red-50 rounded transition"
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
        </div>

        {/* 底部状态 */}
        <div className="px-8 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-500 flex justify-between">
          <span>共 {quotes.length} 条数据</span>
          <span>数据会自动保存供其他用户查看</span>
        </div>
      </div>
    </div>
  );
};
