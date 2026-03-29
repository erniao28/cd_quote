import React, { useState, useEffect } from 'react';
import { DailyPrice, CrawlHistory, ParsedLine } from './types';
import {
  fetchPrices,
  fetchLatestPrices,
  triggerCrawl,
  fetchCrawlHistory,
  getNextWorkday,
  exportExcel,
  fetchTempQuotes,
  saveTempQuotes,
  exportTempExcel,
  triggerDownloadExcel
} from './services/api';
import { InputParser } from './components/InputParser';
import { OutputEditor } from './components/OutputEditor';
import { TempQuoteEditor } from './components/TempQuoteEditor';
import { TempQuoteManager } from './components/TempQuoteManager';
import { ExcelImportModal } from './components/ExcelImportModal';

const App: React.FC = () => {
  const [prices, setPrices] = useState<DailyPrice[]>([]);
  const [crawlHistory, setCrawlHistory] = useState<CrawlHistory[]>([]);
  const [targetDate, setTargetDate] = useState('');
  const [crawlStatus, setCrawlStatus] = useState<{ loading: boolean; message: string; showDownload?: boolean }>({
    loading: false,
    message: ''
  });
  const [activeAction, setActiveAction] = useState<'crawl' | 'download' | null>(null);

  // 输入解析相关
  const [parsedItems, setParsedItems] = useState<ParsedLine[]>([]);
  const [activeTab, setActiveTab] = useState<'crawler' | 'parser'>('crawler');

  // 在线编辑相关
  const [showTempEditor, setShowTempEditor] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string }>({ type: 'info', text: '' });

  // 初始化加载数据
  useEffect(() => {
    loadData();
    loadCrawlHistory();
    autoSetTargetDate();
  }, []);

  const loadData = async () => {
    try {
      const res = await fetchLatestPrices();
      setPrices(res.data || []);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  const loadCrawlHistory = async () => {
    try {
      const res = await fetchCrawlHistory();
      setCrawlHistory(res.data || []);
    } catch (error) {
      console.error('加载爬取历史失败:', error);
    }
  };

  const autoSetTargetDate = async () => {
    try {
      const res = await getNextWorkday();
      setTargetDate(res.data.date);
    } catch (error) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setTargetDate(tomorrow.toISOString().split('T')[0]);
    }
  };

  // 爬取数据并保存到临时表
  const handleCrawl = async () => {
    if (!targetDate) {
      alert('请选择目标日期');
      return;
    }

    setActiveAction('crawl');
    setCrawlStatus({ loading: true, message: '正在爬取...' });

    try {
      const res = await triggerCrawl(targetDate);

      if (res.data?.success) {
        const count = res.data.count || 0;
        const message = res.data.message || '';

        // 无论是否有新数据，都刷新临时报价管理
        window.dispatchEvent(new CustomEvent('refresh-temp-quotes'));

        if (count > 0) {
          setMessage({ type: 'success', text: `爬取成功！已获取 ${count} 条数据并保存到临时表，请在下方"临时报价管理"中查看` });
        } else if (message.includes('已从正式库加载')) {
          setMessage({ type: 'success', text: message });
        } else {
          setMessage({ type: 'info', text: message || '没有新数据' });
        }
        setCrawlStatus({ loading: false, message: '爬取完成' });
      } else {
        setCrawlStatus({ loading: false, message: '爬取失败，请尝试从货币网下载 Excel' });
      }
      loadData();
      loadCrawlHistory();
    } catch (error: any) {
      setCrawlStatus({ loading: false, message: `爬取失败：${error.message}，请尝试从货币网下载 Excel` });
    } finally {
      setActiveAction(null);
    }
  };

  // 从货币网下载 Excel 并自动导入到临时表
  const handleDownloadAndImport = async () => {
    if (!targetDate) {
      alert('请选择目标日期');
      return;
    }

    setActiveAction('download');
    setCrawlStatus({ loading: true, message: '正在下载 Excel...' });

    try {
      const res = await triggerDownloadExcel(targetDate);

      if (res.data?.success) {
        const count = res.data.count || 0;
        const message = res.data.message || '';

        // 无论是否有新数据，都刷新临时报价管理
        window.dispatchEvent(new CustomEvent('refresh-temp-quotes'));

        if (count > 0) {
          setMessage({ type: 'success', text: `下载成功！已获取 ${count} 条数据并保存到临时表，请在下方"临时报价管理"中查看` });
        } else if (message.includes('已从正式库加载') || message.includes('成功')) {
          setMessage({ type: 'success', text: message });
        } else {
          setMessage({ type: 'info', text: message || '没有新数据' });
        }
        setCrawlStatus({ loading: false, message: '下载完成' });
        loadData();
      } else {
        setCrawlStatus({ loading: false, message: `下载失败：${res.data?.message || '未知错误'}` });
      }
    } catch (error: any) {
      setCrawlStatus({ loading: false, message: `下载失败：${error.message}` });
    } finally {
      setActiveAction(null);
    }
  };

  // 打开货币网下载页面（备用方案）
  const handleOpenChinamoney = () => {
    const chinamoneyUrl = 'https://www.chinamoney.com.cn/chinese/tycdfxxx/?issueStType=1';
    window.open(chinamoneyUrl, '_blank');
    setMessage({ type: 'info', text: '已在新的窗口打开货币网，请下载 Excel 后上传' });
  };

  // 导入临时表并打开编辑器
  const handleOpenEditor = async () => {
    if (!targetDate) {
      alert('请先选择目标日期');
      return;
    }

    try {
      // 先检查临时表是否已有数据
      const tempRes = await fetchTempQuotes();
      const existingTemp = tempRes.data || [];

      if (existingTemp.length > 0) {
        // 临时表已有数据，直接打开编辑器
        setShowTempEditor(true);
        return;
      }

      // 临时表为空，尝试从正式库获取数据
      setMessage({ type: 'info', text: '正在加载数据...' });

      const res = await fetchPrices(targetDate);
      const prices = res.data || [];

      if (prices.length === 0) {
        // 正式库也没有数据，询问用户
        if (confirm(`当前日期（${targetDate}）没有数据。是否打开空编辑器手动添加？`)) {
          setShowTempEditor(true);
        }
        setMessage({ type: 'info', text: '' });
        return;
      }

      // 保存到临时表
      await saveTempQuotes(prices);
      setMessage({ type: 'success', text: `已加载 ${prices.length} 条数据到临时表` });
      setShowTempEditor(true);
    } catch (error: any) {
      console.error('打开编辑器失败:', error);
      // 出错时打开空编辑器
      if (confirm(`加载数据失败：${error.message}。是否打开空编辑器手动添加？`)) {
        setShowTempEditor(true);
      }
    }
  };

  const handleRefresh = () => {
    loadData();
    loadCrawlHistory();
  };

  const handleParsed = (results: ParsedLine[]) => {
    setParsedItems(results);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* 顶部导航栏 */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2 rounded-xl font-bold text-xl">CD.Quote</div>
          <h1 className="text-lg font-bold text-slate-800">货币网爬虫系统</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('crawler')}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${
              activeTab === 'crawler' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            数据爬取
          </button>
          <button
            onClick={() => setActiveTab('parser')}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${
              activeTab === 'parser' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            报价解析
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200"
          >
            刷新
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8 grid grid-cols-12 gap-8 w-full">
        {activeTab === 'crawler' ? (
          <>
            {/* 左侧：控制面板 */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* 日期选择 */}
              <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span> 1. 选择发行日期
                </h2>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-orange-200 transition-all"
                />
                <p className="text-xs text-slate-400 mt-2">
                  默认下一个工作日，可根据调休手动调整
                </p>
              </section>

              {/* 数据操作 */}
              <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 2. 获取数据
                </h2>

                {/* 方案 1：自动爬取 */}
                <div className="mb-4">
                  <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
                    方案 A：自动爬取（推荐）
                  </div>
                  <button
                    onClick={handleCrawl}
                    disabled={activeAction === 'crawl' || !targetDate}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {activeAction === 'crawl' ? '爬取中...' : '从货币网自动爬取'}
                  </button>
                  <p className="text-xs text-slate-400 mt-2">
                    直接从中国货币网爬取数据，自动保存到临时表，可立即用于报价解析
                  </p>
                </div>

                {/* 分隔线 */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200"></div>
                  <span className="text-xs text-slate-400 font-bold">或</span>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                {/* 方案 2：下载并导入 */}
                <div className="mb-4">
                  <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">2</span>
                    方案 B：下载并导入（备选）
                  </div>
                  <button
                    onClick={handleDownloadAndImport}
                    disabled={activeAction === 'download' || !targetDate}
                    className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {activeAction === 'download' ? '下载中...' : '从货币网下载 Excel 并导入'}
                  </button>
                  <p className="text-xs text-slate-400 mt-2">
                    当自动爬取失败时，从货币网下载 Excel 并自动导入到临时表
                  </p>
                </div>

                {/* 分隔线 */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-slate-200"></div>
                  <span className="text-xs text-slate-400 font-bold">或</span>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                {/* 方案 3：手动上传 Excel（最后的选择） */}
                <div className="mb-4">
                  <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">3</span>
                    方案 C：手动上传（最后的选择）
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleOpenChinamoney}
                      disabled={!targetDate}
                      className="flex-1 py-3 bg-white border-2 border-emerald-500 text-emerald-600 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      打开货币网
                    </button>
                    <button
                      onClick={() => setShowImportModal(true)}
                      disabled={!targetDate}
                      className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4 4 4m-4-4v12" />
                      </svg>
                      上传 Excel
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    当以上方法都失败时，手动从货币网下载 Excel 后上传
                  </p>
                </div>

                {/* 在线编辑按钮 */}
                <button
                  onClick={handleOpenEditor}
                  disabled={!targetDate}
                  className="w-full mt-2 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  在线编辑（临时表）
                </button>

                {/* 状态消息 */}
                {crawlStatus.message && (
                  <div className={`mt-3 p-3 rounded-xl text-sm font-bold ${
                    crawlStatus.message.includes('失败') || crawlStatus.message.includes('错误')
                      ? 'bg-red-50 text-red-600'
                      : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {crawlStatus.message}
                  </div>
                )}
                {message.text && (
                  <div className={`mt-3 p-3 rounded-xl text-sm font-bold ${
                    message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {message.text}
                  </div>
                )}
              </section>

              {/* 爬取历史 */}
              <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                  爬取历史
                </h2>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {crawlHistory.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 bg-slate-50 rounded-xl"
                    >
                      <div>
                        <div className="text-sm font-bold">{item.target_date}</div>
                        <div className="text-xs text-slate-400">{item.crawl_date}</div>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded ${
                        item.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {item.status === 'success' ? '成功' : '失败'} ({item.count})
                      </div>
                    </div>
                  ))}
                  {crawlHistory.length === 0 && (
                    <div className="text-center text-slate-300 py-8">暂无爬取记录</div>
                  )}
                </div>
              </section>
            </div>

            {/* 右侧：数据展示 */}
            <div className="col-span-12 lg:col-span-8 space-y-4">
              {/* 数据列表 */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm min-h-[400px]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    数据列表
                  </h2>
                  <div className="text-sm text-slate-500">
                    共 {prices.length} 条
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 font-bold text-slate-500">存单代码</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-500">存单简称</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-500">发行日期</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-500">期限</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-500">发行价格</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-500">参考收益率</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-500">计划发行量</th>
                        <th className="text-left py-3 px-4 font-bold text-slate-500">评级</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices.map((price) => (
                        <tr key={price.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono">{price.issue_code}</td>
                          <td className="py-3 px-4 font-bold">{price.issue_name}</td>
                          <td className="py-3 px-4">{price.issue_date}</td>
                          <td className="py-3 px-4">{price.tenor}</td>
                          <td className="py-3 px-4 font-bold text-indigo-600">{price.price || '-'}</td>
                          <td className="py-3 px-4">{price.ref_yield || '-'}</td>
                          <td className="py-3 px-4">{price.volume || '-'}</td>
                          <td className="py-3 px-4">{price.rating || '-'}</td>
                        </tr>
                      ))}
                      {prices.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-20 text-slate-300">
                            暂无数据，点击"开始爬取"获取最新价格
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 临时报价管理 */}
              <TempQuoteManager onQuoteDeleted={loadData} />
            </div>
          </>
        ) : (
          /* 报价解析标签页 */
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <InputParser onParsed={handleParsed} issueDate={targetDate} />
            <OutputEditor items={parsedItems} issueDate={targetDate} />
          </div>
        )}
      </main>

      {/* 在线编辑器模态框 */}
      {showTempEditor && (
        <TempQuoteEditor
          targetDate={targetDate}
          onClose={() => setShowTempEditor(false)}
        />
      )}

      {/* Excel 导入模态框 */}
      {showImportModal && (
        <ExcelImportModal
          targetDate={targetDate}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={() => {
            loadData();
            setShowImportModal(false);
          }}
        />
      )}

      <footer className="p-8 text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">
        CD.Quote • 货币网爬虫系统
      </footer>
    </div>
  );
};

export default App;
