import React, { useState, useRef } from 'react';
import { uploadExcel, saveTempQuotes } from '../services/api';
import { parseExcelFile } from '../utils/parser';

interface ParsedData {
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
  onImportSuccess?: () => void;
}

export const ExcelImportModal: React.FC<Props> = ({ targetDate, onClose, onImportSuccess }) => {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'temp' | 'official'>('temp');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file || !file.name.endsWith('.xlsx')) {
      alert('请上传 Excel 文件 (.xlsx)');
      return;
    }

    setParsing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const base64 = arrayBufferToBase64(arrayBuffer);

          // 调用后端解析
          const res = await uploadExcel(base64);
          setParsedData(res.data?.parsedData || []);
        } catch (error) {
          alert(`解析失败：${error}`);
        } finally {
          setParsing(false);
        }
      };
      reader.onerror = () => {
        alert('读取文件失败');
        setParsing(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      alert(`读取文件失败：${error}`);
      setParsing(false);
    }
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    try {
      // 更新发行日期为目标日期
      const dataWithDate = parsedData.map(item => ({
        ...item,
        issue_date: item.issue_date || targetDate,
        id: `${item.issue_code}_${item.issue_date || targetDate}_${Date.now()}`
      }));

      // 保存到临时表或正式表
      if (importMode === 'temp') {
        await saveTempQuotes(dataWithDate);
        alert(`已导入 ${dataWithDate.length} 条数据到临时表，可在"在线编辑"中继续编辑`);
      } else {
        // 直接保存到正式表（调用 confirm 接口）
        await saveTempQuotes(dataWithDate);
        // 确认后转入正式表
        const confirmRes = await fetch(`${window.location.hostname === 'localhost' ? 'http://localhost:3002' : '/auto-quote-api'}/temp-quotes/confirm`, {
          method: 'POST'
        });
        const confirmData = await confirmRes.json();
        alert(`已导入 ${confirmData.data?.count || dataWithDate.length} 条数据到正式库`);
      }

      onImportSuccess?.();
      onClose();
    } catch (error: any) {
      alert(`导入失败：${error.message || error}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">导入 Excel</h3>
            <p className="text-sm text-slate-500 mt-1">
              当自动爬取失败时，可手动导入 Excel 文件
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

        {/* 内容 */}
        <div className="flex-1 overflow-auto p-6">
          {/* 上传区域 */}
          {!parsedData.length && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition ${
                dragOver
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-slate-300 hover:border-emerald-300 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                className="hidden"
              />
              <div className="text-4xl mb-4">📁</div>
              {parsing ? (
                <div className="text-slate-600">解析中...</div>
              ) : (
                <>
                  <div className="text-slate-700 font-bold mb-2">
                    点击或拖拽上传 Excel 文件
                  </div>
                  <div className="text-sm text-slate-400">
                    支持 .xlsx 格式，自动解析存单代码、简称、期限、价格等字段
                  </div>
                </>
              )}
            </div>
          )}

          {/* 解析结果预览 */}
          {parsedData.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-700">
                  解析结果 ({parsedData.length} 条)
                </h4>
                <button
                  onClick={() => setParsedData([])}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  重新上传
                </button>
              </div>

              <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-bold text-slate-500">存单代码</th>
                      <th className="text-left py-2 px-3 font-bold text-slate-500">存单简称</th>
                      <th className="text-left py-2 px-3 font-bold text-slate-500">发行日期</th>
                      <th className="text-left py-2 px-3 font-bold text-slate-500">期限</th>
                      <th className="text-left py-2 px-3 font-bold text-slate-500">价格</th>
                      <th className="text-left py-2 px-3 font-bold text-slate-500">收益率</th>
                      <th className="text-left py-2 px-3 font-bold text-slate-500">发行量</th>
                      <th className="text-left py-2 px-3 font-bold text-slate-500">评级</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono">{item.issue_code || '-'}</td>
                        <td className="py-2 px-3 font-bold">{item.issue_name || '-'}</td>
                        <td className="py-2 px-3">{item.issue_date || targetDate || '-'}</td>
                        <td className="py-2 px-3">{item.tenor || '-'}</td>
                        <td className="py-2 px-3 font-bold text-indigo-600">{item.price || '-'}</td>
                        <td className="py-2 px-3">{item.ref_yield || '-'}</td>
                        <td className="py-2 px-3">{item.volume || '-'}</td>
                        <td className="py-2 px-3">{item.rating || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 导入选项 */}
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-sm font-bold text-slate-700 mb-2">导入到：</div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'temp'}
                      onChange={() => setImportMode('temp')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-sm text-slate-600">
                      临时表（可继续编辑）
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'official'}
                      onChange={() => setImportMode('official')}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm text-slate-600">
                      正式库（直接确认）
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          {parsedData.length > 0 ? (
            <>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-300"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 disabled:opacity-50"
              >
                {importing ? '导入中...' : `确认导入 (${parsedData.length} 条)`}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-300"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
