import React, { useState, useEffect } from 'react';
import { ParsedLine, parseBatchInput, matchBankName, normalizeTenor, normalizeVolume } from '../utils/parser';
import { fetchLatestPrices, fetchTempQuotes } from '../services/api';

interface PriceData {
  issue_code: string;
  issue_name: string;
  issue_date: string;
  tenor: string;
  price: string;
  bank_name: string;
  ref_yield?: string;
  volume?: string;
  rating?: string;
  source?: 'official' | 'temp';  // 数据来源标记
}

interface Props {
  onParsed: (results: ParsedLine[]) => void;
  issueDate?: string;
}

export const InputParser: React.FC<Props> = ({ onParsed, issueDate }) => {
  const [inputText, setInputText] = useState('');
  const [parsedResults, setParsedResults] = useState<ParsedLine[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [officialData, setOfficialData] = useState<PriceData[]>([]);
  const [tempData, setTempData] = useState<PriceData[]>([]);
  const [matchedResults, setMatchedResults] = useState<ParsedLine[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);

  // 加载正式库数据
  useEffect(() => {
    const loadPrices = async () => {
      try {
        const res = await fetchLatestPrices();
        setOfficialData((res.data || []).map(item => ({ ...item, source: 'official' as const })));
      } catch (error) {
        console.error('加载正式库数据失败:', error);
      }
    };
    loadPrices();
  }, []);

  // 加载临时表数据
  useEffect(() => {
    const loadTempQuotes = async () => {
      try {
        const res = await fetchTempQuotes();
        setTempData((res.data || []).map(item => ({ ...item, source: 'temp' as const })));
      } catch (error) {
        console.error('加载临时表数据失败:', error);
      }
    };
    loadTempQuotes();
  }, []);

  // 合并数据源
  const allData = [...officialData, ...tempData];

  // 根据银行名称和期限匹配价格数据
  const matchPriceData = (bankName: string, tenor: string): PriceData[] => {
    // 期限标准化映射
    const tenorMap: Record<string, string[]> = {
      '1M': ['1M', '1 个月', '30 天', '0.25Y'],
      '2M': ['2M', '2 个月', '60 天'],
      '3M': ['3M', '3 个月', '90 天', '0.5Y'],
      '4M': ['4M', '4 个月', '120 天'],
      '5M': ['5M', '5 个月', '150 天', '0.75Y'],
      '6M': ['6M', '6 个月', '180 天', '0.5Y', '半年'],
      '7M': ['7M', '7 个月', '210 天'],
      '8M': ['8M', '8 个月', '240 天'],
      '9M': ['9M', '9 个月', '270 天', '0.75Y'],
      '10M': ['10M', '10 个月', '300 天'],
      '11M': ['11M', '11 个月', '330 天'],
      '1Y': ['1Y', '1 年', '12M', '365 天', '年'],
    };

    const targetTenors = tenorMap[tenor] || [tenor];

    // 找出所有匹配的项，返回多个供用户选择
    return allData.filter(item => {
      // 银行名称匹配
      const bankMatch = item.bank_name.includes(bankName) ||
                        item.issue_name.includes(bankName) ||
                        item.issue_name.includes(bankName.replace('银行', ''));
      // 期限匹配
      const tenorMatch = targetTenors.some(t => item.tenor.includes(t)) ||
                         targetTenors.some(t => tenor.includes(item.tenor));
      return bankMatch || tenorMatch;
    });
  };

  const handleParse = () => {
    const results = parseBatchInput(inputText);
    setParsedResults(results);
    setShowPreview(true);
    setMatchedResults([]);  // 清空之前的匹配结果
    onParsed(results);
  };

  // 打开匹配弹窗
  const handleMatch = () => {
    const results = parsedResults.map(item => {
      const matches = matchPriceData(item.bankName, item.tenor);
      return {
        ...item,
        _matches: matches,  // 附加匹配到的数据
        matched: matches.length > 0
      };
    });
    setMatchedResults(results);
    setShowMatchModal(true);
  };

  // 处理单条匹配确认
  const handleMatchConfirm = (index: number, matchedData: PriceData) => {
    // 只更新 matchedResults，不直接更新 parsedResults
    const updatedMatched = [...matchedResults];
    updatedMatched[index] = {
      ...updatedMatched[index],
      issueCode: matchedData.issue_code,
      issueName: matchedData.issue_name,
      issueDate: matchedData.issue_date || issueDate,
      price: matchedData.price,
      refYield: matchedData.ref_yield,
      volume: matchedData.volume,
      rating: matchedData.rating,
      tenor: matchedData.tenor,
      matched: true,
      _selectedMatch: matchedData  // 标记已选择
    };
    setMatchedResults(updatedMatched);
  };

  // 关闭匹配弹窗（放弃所有更改）
  const handleCloseMatchModal = () => {
    setShowMatchModal(false);
  };

  // 应用匹配结果
  const applyMatchedResults = () => {
    const updated = matchedResults.map((result) => ({
      bankName: result.bankName,
      tenor: result.tenor,
      yield: result.yield,
      volume: result.volume,
      weekday: result.weekday,
      rating: result.rating,
      raw: result.raw,
      matched: result.matched,
      issues: result.issues,
      issueCode: result.issueCode,
      issueName: result.issueName,
      issueDate: result.issueDate,
      price: result.price,
      refYield: result.refYield
    }));
    setParsedResults(updated);
    onParsed(updated);
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
          onClick={handleMatch}
          disabled={!showPreview || parsedResults.length === 0}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
        >
          匹配数据
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

      {/* 匹配结果弹窗 */}
      {showMatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* 头部 */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">匹配数据</h3>
                <p className="text-sm text-slate-500 mt-1">
                  为每条报价选择匹配的数据，支持手动调整
                </p>
              </div>
              <button
                onClick={() => {
                  applyMatchedResults();
                  setShowMatchModal(false);
                }}
                className="p-2 hover:bg-slate-100 rounded-xl transition"
                title="确认并关闭"
              >
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 匹配列表 */}
            <div className="flex-1 overflow-auto p-6">
              {matchedResults.map((result, idx) => (
                <MatchItem
                  key={idx}
                  parsedItem={result}
                  matches={result._matches || []}
                  issueDate={issueDate}
                  hasSelected={!!result._selectedMatch}
                  onConfirm={(matchedData) => handleMatchConfirm(idx, matchedData)}
                />
              ))}
            </div>

            {/* 底部按钮 */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={handleCloseMatchModal}
                className="px-6 py-2 bg-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-300"
              >
                取消
              </button>
              <button
                onClick={() => {
                  applyMatchedResults();
                  setShowMatchModal(false);
                }}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
              >
                确认并关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// 匹配项组件
const MatchItem: React.FC<{
  parsedItem: ParsedLine & { _matches?: PriceData[] };
  matches: PriceData[];
  issueDate?: string;
  hasSelected?: boolean;
  onConfirm: (data: PriceData) => void;
}> = ({ parsedItem, matches, issueDate, hasSelected, onConfirm }) => {
  const [selectedMatch, setSelectedMatch] = useState<PriceData | null>(
    matches[0] || null
  );

  return (
    <div className={`mb-6 p-4 rounded-xl border ${hasSelected ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
      {/* 解析结果 */}
      <div className="mb-3">
        <div className="text-xs font-bold text-slate-500 mb-2">解析结果</div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
            {parsedItem.bankName}
          </span>
          <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-indigo-600">
            {parsedItem.tenor}
          </span>
          {parsedItem.yield && (
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-emerald-600">
              {parsedItem.yield}
            </span>
          )}
          {parsedItem.rating && (
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
              {parsedItem.rating}
            </span>
          )}
          {parsedItem.volume && (
            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm text-slate-600">
              {parsedItem.volume}
            </span>
          )}
          {hasSelected && (
            <span className="text-xs font-bold text-emerald-600 ml-2">✓ 已选择</span>
          )}
        </div>
      </div>

      {/* 匹配到的数据 */}
      <div>
        <div className="text-xs font-bold text-slate-500 mb-2">
          匹配到的数据 ({matches.length})
        </div>
        {matches.length === 0 ? (
          <div className="text-sm text-amber-600">未找到匹配的数据，请手动输入</div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {matches.map((match, idx) => (
              <label
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  selectedMatch?.issue_code === match.issue_code
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                } ${hasSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name={`match_${parsedItem.bankName}_${idx}`}
                  checked={selectedMatch?.issue_code === match.issue_code}
                  onChange={() => !hasSelected && setSelectedMatch(match)}
                  disabled={hasSelected}
                  className="w-4 h-4 text-indigo-600"
                />
                <div className="flex-1 flex flex-wrap gap-3 text-sm">
                  <span className="font-bold text-slate-800">{match.issue_code}</span>
                  <span className="text-slate-700">{match.issue_name}</span>
                  <span className="text-indigo-600 font-bold">{match.tenor}</span>
                  <span className="text-emerald-600 font-bold">{match.price || match.ref_yield}</span>
                  <span className="text-slate-400 text-xs">发行：{match.issue_date || issueDate}</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 确认按钮 */}
      {selectedMatch && !hasSelected && (
        <button
          onClick={() => onConfirm(selectedMatch)}
          className="mt-3 w-full py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition"
        >
          确认选择：{selectedMatch.issue_code} {selectedMatch.issue_name}
        </button>
      )}
      {hasSelected && (
        <div className="mt-3 w-full py-2 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm text-center">
          ✓ 已确认
        </div>
      )}
    </div>
  );
};
