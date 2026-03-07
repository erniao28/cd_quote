import React, { useState } from 'react';
import { ParsedLine, parseBatchInput, matchBankName, normalizeTenor, normalizeVolume } from '../utils/parser';

interface Props {
  onParsed: (results: ParsedLine[]) => void;
}

export const InputParser: React.FC<Props> = ({ onParsed }) => {
  const [inputText, setInputText] = useState('');
  const [parsedResults, setParsedResults] = useState<ParsedLine[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleParse = () => {
    const results = parseBatchInput(inputText);
    setParsedResults(results);
    setShowPreview(true);
    onParsed(results);
  };

  const handleClear = () => {
    setInputText('');
    setParsedResults([]);
    setShowPreview(false);
  };

  const handleUpdateItem = (index: number, field: keyof ParsedLine, value: string) => {
    const updated = [...parsedResults];
    if (field === 'bankName') {
      const bank = matchBankName(value) || value;
      updated[index][field] = bank;
    } else if (field === 'tenor') {
      const tenor = normalizeTenor(value) || value;
      updated[index][field] = tenor;
    } else {
      updated[index][field] = value;
    }
    setParsedResults(updated);
    onParsed(updated);
  };

  const handleBulkUpdate = (field: keyof ParsedLine, value: string) => {
    const updated = parsedResults.map(item => {
      if (field === 'bankName') {
        const bank = matchBankName(value) || value;
        return { ...item, [field]: bank };
      } else if (field === 'tenor') {
        const tenor = normalizeTenor(value) || value;
        return { ...item, [field]: tenor };
      }
      return { ...item, [field]: value };
    });
    setParsedResults(updated);
    onParsed(updated);
  };

  const successCount = parsedResults.filter(r => r.matched).length;

  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 输入解析
      </h2>

      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder={`批量输入报价，每行一条
示例：
兴业银行 AAA 6M 1.62% 周一 5 亿
浦发银行 AA+ 3M 1.55% 3e
招商银行 90 天 1.58%`}
        className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-emerald-200 transition-all resize-none font-mono"
      />

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleParse}
          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
        >
          解析输入
        </button>
        <button
          onClick={handleClear}
          className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
        >
          清空
        </button>
      </div>

      {/* 解析结果预览 */}
      {showPreview && parsedResults.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-bold text-slate-700">
              解析结果 ({successCount}/{parsedResults.length})
            </h3>
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkUpdate(e.target.name as keyof ParsedLine, e.target.value);
                    e.target.value = '';
                  }
                }}
                className="text-xs bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg"
              >
                <option value="">批量设置...</option>
                <option name="rating" value="AAA">评级→AAA</option>
                <option name="rating" value="AA+">评级→AA+</option>
                <option name="weekday" value="周一">周次→周一</option>
                <option name="weekday" value="周二">周次→周二</option>
                <option name="weekday" value="周三">周次→周三</option>
                <option name="weekday" value="周四">周次→周四</option>
                <option name="weekday" value="周五">周次→周五</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {parsedResults.map((item, index) => (
              <div
                key={index}
                className={`p-3 rounded-xl border ${
                  item.matched ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    value={item.bankName || ''}
                    onChange={(e) => handleUpdateItem(index, 'bankName', e.target.value)}
                    placeholder="银行"
                    className="w-24 text-xs bg-white border border-slate-200 rounded px-2 py-1"
                  />
                  <input
                    value={item.tenor || ''}
                    onChange={(e) => handleUpdateItem(index, 'tenor', e.target.value)}
                    placeholder="期限"
                    className="w-16 text-xs bg-white border border-slate-200 rounded px-2 py-1"
                  />
                  <input
                    value={item.yield || ''}
                    onChange={(e) => handleUpdateItem(index, 'yield', e.target.value)}
                    placeholder="收益率"
                    className="w-20 text-xs bg-white border border-slate-200 rounded px-2 py-1"
                  />
                  <input
                    value={item.volume || ''}
                    onChange={(e) => handleUpdateItem(index, 'volume', normalizeVolume(e.target.value) || e.target.value)}
                    placeholder="量"
                    className="w-16 text-xs bg-white border border-slate-200 rounded px-2 py-1"
                  />
                  <input
                    value={item.weekday || ''}
                    onChange={(e) => handleUpdateItem(index, 'weekday', e.target.value)}
                    placeholder="周次"
                    className="w-16 text-xs bg-white border border-slate-200 rounded px-2 py-1"
                  />
                  {item.issues.length > 0 && (
                    <span className="text-xs text-amber-600">
                      ⚠️ {item.issues.join(', ')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1 font-mono">
                  原始：{item.raw}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
