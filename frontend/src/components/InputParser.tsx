import React, { useState, useEffect } from 'react';
import { ParsedLine, parseBatchInput, matchBankName, normalizeTenor, normalizeVolume } from '../utils/parser';
import { fetchLatestPrices } from '../services/api';

interface PriceData {
  issue_code: string;
  issue_name: string;
  issue_date: string;
  tenor: string;
  price: string;
  bank_name: string;
}

interface Props {
  onParsed: (results: ParsedLine[]) => void;
  issueDate?: string;  // 新增：发行日期
}

export const InputParser: React.FC<Props> = ({ onParsed, issueDate }) => {
  const [inputText, setInputText] = useState('');
  const [parsedResults, setParsedResults] = useState<ParsedLine[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [priceData, setPriceData] = useState<PriceData[]>([]);

  // 加载最新价格数据用于匹配
  useEffect(() => {
    const loadPrices = async () => {
      try {
        const res = await fetchLatestPrices();
        setPriceData(res.data || []);
      } catch (error) {
        console.error('加载价格数据失败:', error);
      }
    };
    loadPrices();
  }, []);

  // 根据银行名称和期限匹配价格数据
  const matchPriceData = (bankName: string, tenor: string): PriceData | null => {
    // 期限标准化匹配
    const tenorMap: Record<string, string[]> = {
      '1M': ['1M', '1 个月', '30 天'],
      '2M': ['2M', '2 个月', '60 天'],
      '3M': ['3M', '3 个月', '90 天'],
      '4M': ['4M', '4 个月', '120 天'],
      '5M': ['5M', '5 个月', '150 天'],
      '6M': ['6M', '6 个月', '180 天'],
      '7M': ['7M', '7 个月', '210 天'],
      '8M': ['8M', '8 个月', '240 天'],
      '9M': ['9M', '9 个月', '270 天'],
      '10M': ['10M', '10 个月', '300 天'],
      '11M': ['11M', '11 个月', '330 天'],
      '1Y': ['1Y', '1 年', '12M', '365 天'],
    };

    const targetTenors = tenorMap[tenor] || [tenor];

    return priceData.find(item => {
      // 银行名称匹配（简称包含即可）
      const bankMatch = item.bank_name.includes(bankName) || item.issue_name.includes(bankName);
      // 期限匹配
      const tenorMatch = targetTenors.some(t => item.tenor.includes(t) || tenor.includes(item.tenor));
      return bankMatch && tenorMatch;
    }) || null;
  };

  const handleParse = () => {
    const results = parseBatchInput(inputText);

    // 自动匹配价格数据
    const matchedResults = results.map(item => {
      const matched = matchPriceData(item.bankName, item.tenor);
      if (matched) {
        return {
          ...item,
          matched: true,
          issueCode: matched.issue_code,
          issueName: matched.issue_name,
          price: matched.price,
          issueDate: matched.issue_date || issueDate
        };
      }
      return item;
    });

    setParsedResults(matchedResults);
    setShowPreview(true);
    onParsed(matchedResults);
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
