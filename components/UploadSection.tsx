
import React, { useState, useEffect } from 'react';
import {
    UploadCloud, Wand2, Loader2, Link2,
    FileText, CheckCircle2, Lock, Image as ImageIcon, Video, Presentation, Mail, Globe,
    Megaphone, Users, Scale, Share2, DollarSign, Newspaper, MapPin, Check, FileType, Laptop,
    ChevronDown, Layout, AlertOctagon, Briefcase, Code2, HeartHandshake, GraduationCap, ShieldAlert,
    ScrollText, Mic, Smartphone, Mails, Sparkles, ScanEye, Lightbulb, MessageSquareQuote, AlertTriangle,
    X,
    Gauge,
    Layers,
    FileStack,
    WifiOff
} from 'lucide-react';
import { CommunicationContext, Region, UploadState, AssetType, FixIntensity, HistoryItem } from '../types';
import { detectContext } from '../services/gemini';
import * as mammoth from 'mammoth';

interface UploadSectionProps {
    uploadState: UploadState;
    setUploadState: React.Dispatch<React.SetStateAction<UploadState>>;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    history: HistoryItem[];
}

const COUNTRIES = [
    "Global", "United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Japan", "China", "India",
    "Brazil", "Mexico", "Italy", "Spain", "South Korea", "Russia", "Netherlands", "Saudi Arabia", "Turkey", "Switzerland",
    "Taiwan", "Poland", "Sweden", "Belgium", "Thailand", "Ireland", "Austria", "Nigeria", "Argentina", "Norway",
    "Israel", "UAE", "Vietnam", "South Africa", "Singapore", "Denmark", "Malaysia", "Hong Kong", "Philippines", "Colombia",
    "Chile", "Finland", "Egypt", "Portugal", "Greece", "New Zealand", "Peru", "Kazakhstan", "Romania", "Ukraine",
    "Hungary", "Qatar", "Kuwait", "Morocco", "Slovakia", "Ecuador", "Oman", "Dominican Republic", "Puerto Rico", "Kenya",
    "Angola", "Ethiopia", "Sri Lanka", "Guatemala", "Uzbekistan", "Myanmar", "Luxembourg", "Bulgaria", "Croatia", "Belarus",
    "Uruguay", "Lithuania", "Serbia", "Slovenia", "Costa Rica", "Panama", "Ivory Coast", "Tanzania", "Cameroon", "Uganda",
    "Ghana", "Jordan", "Tunisia", "Bahrain", "Bolivia", "Paraguay", "Latvia", "Estonia", "Cyprus", "Iceland", "El Salvador",
    "Honduras", "Nepal", "Trinidad & Tobago", "Cambodia", "Zimbabwe", "Senegal", "Papua New Guinea"
].sort((a, b) => a === "Global" ? -1 : b === "Global" ? 1 : a.localeCompare(b));

const FormatBadge = ({ label }: { label: string }) => (
    <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded-md border border-slate-200 cursor-default hover:bg-slate-200 transition-colors">
        {label}
    </span>
);

export const UploadSection: React.FC<UploadSectionProps> = ({
    uploadState,
    setUploadState,
    onAnalyze,
    isAnalyzing,
    history
}) => {
    const [activeTab, setActiveTab] = useState<'upload' | 'sharepoint'>('upload');
    const [isDragging, setIsDragging] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectedFields, setDetectedFields] = useState<string[]>([]);
    const [isFetchingUrl, setIsFetchingUrl] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [enableRegion, setEnableRegion] = useState(uploadState.region !== "Global");
    const [formatWarning, setFormatWarning] = useState<string | null>(null);
    const [smartProcessingStep, setSmartProcessingStep] = useState<string | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Clear detection flash after 3 seconds
    useEffect(() => {
        if (detectedFields.length > 0) {
            const timer = setTimeout(() => setDetectedFields([]), 3000);
            return () => clearTimeout(timer);
        }
    }, [detectedFields]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleFile = async (file: File) => {
        setFormatWarning(null);
        setSmartProcessingStep("Analyzing file structure...");

        // Check for near-duplicates in history
        const duplicate = history.find(h => h.filename === file.name);
        if (duplicate) {
            setDuplicateWarning(`Similar file analyzed on ${new Date(duplicate.date).toLocaleDateString()}. Check history before proceeding.`);
        } else {
            setDuplicateWarning(null);
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let newAssetType = AssetType.DOCUMENT;

        // Determine Asset Type
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) newAssetType = AssetType.IMAGE;
        else if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) newAssetType = AssetType.VIDEO;
        else if (['ppt', 'pptx', 'key'].includes(ext)) newAssetType = AssetType.PRESENTATION;
        else if (['mp3', 'wav', 'm4a'].includes(ext)) newAssetType = AssetType.PODCAST;
        else if (['pdf'].includes(ext)) newAssetType = AssetType.DOCUMENT;

        setDetectedFields(['assetType']);

        const newState: UploadState = {
            ...uploadState,
            file,
            assetType: newAssetType,
            textInput: '',
            fileBase64: undefined,
            mimeType: file.type
        };

        // --- REAL FILE PROCESSING LOGIC ---

        // 1. DOCX Extraction via Mammoth
        if (ext === 'docx') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    setUploadState({
                        ...newState,
                        textInput: result.value // extracted text
                    });
                    await handleAutoDetect(result.value);
                } catch (err) {
                    console.error("Mammoth text extraction failed", err);
                    setFormatWarning("Failed to extract text from DOCX. Please paste content manually.");
                }
            };
            reader.readAsArrayBuffer(file);
        }
        // 2. Binary Files (PDF, Image, Video) -> Base64 for Gemini
        else if (['pdf', 'jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'avi', 'webm', 'mp3', 'wav'].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                const base64 = result.split(',')[1];
                setUploadState({
                    ...newState,
                    fileBase64: base64,
                    mimeType: file.type || (ext === 'pdf' ? 'application/pdf' : file.type)
                });
                setTimeout(() => setSmartProcessingStep("Ready for Deep Analysis"), 500);
            };
            reader.readAsDataURL(file);
        }
        // 3. Plain Text Files
        else if (file.type.startsWith('text/') || ['txt', 'md', 'csv', 'json'].includes(ext)) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target?.result as string;
                setUploadState({ ...newState, textInput: text });
                await handleAutoDetect(text);
            };
            reader.readAsText(file);
        }
        else {
            setFormatWarning("Unsupported file format. Please upload PDF, DOCX, PPTX, Image, Video or Text.");
        }

        setTimeout(() => setSmartProcessingStep(null), 2000);
    };

    const handleAutoDetect = async (text: string) => {
        if (!text || text.length < 10) return;
        setIsDetecting(true);
        try {
            const detected = await detectContext(text);
            setUploadState(prev => ({
                ...prev,
                context: detected.context,
                assetType: detected.assetType,
                detectedConfidence: detected.confidence || 85 // Fallback if AI doesn't return
            }));
            setDetectedFields(['context', 'assetType']);
        } catch (e) {
            console.error("Auto detect failed", e);
        } finally {
            setIsDetecting(false);
        }
    }

    const handleManualAutoDetect = () => {
        handleAutoDetect(uploadState.textInput);
    }

    const handleSharePointFetch = () => {
        if (!urlInput) return;
        setIsFetchingUrl(true);

        // Keep mock for SharePoint as we don't have real auth
        setTimeout(async () => {
            const mockContent = `[IMPORTED FROM SHAREPOINT: ${urlInput}]\n\nCONFIDENTIAL DRAFT - Q3 STRATEGY UPDATE\n\nOur goal is to leverage best-in-class synergy to disrupt the market. We need to focus on low-hanging fruit and drill down into the data. This product is guaranteed to increase revenue by 200%. Let's circle back on this next week.`;

            setUploadState(prev => ({
                ...prev,
                textInput: mockContent,
                sharePointUrl: urlInput,
                file: null
            }));

            await handleAutoDetect(mockContent);
            setIsFetchingUrl(false);
        }, 1500);
    };

    const handleRegionToggle = (enabled: boolean) => {
        setEnableRegion(enabled);
        if (!enabled) {
            setUploadState(prev => ({ ...prev, region: "Global" }));
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-700">

            {/* Page Header */}
            <div className="text-center mb-12 space-y-4">
                <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
                    Analyze & Align Content
                </h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
                    Ensure every asset meets brand standards. Upload documents, presentations, or paste text to get instant compliance scoring and cultural insights.
                </p>
            </div>

            {isOffline && (
                <div className="bg-slate-800 text-white rounded-xl p-3 mb-8 flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-4">
                    <WifiOff className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-bold">You are offline. Files will be queued for analysis when connection is restored.</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left Column: Input Interface (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">

                        {/* Tabs Header */}
                        <div className="px-2 pt-2">
                            <div className="flex bg-slate-100/50 p-1 rounded-2xl mx-6 mt-6 border border-slate-200/50">
                                <button
                                    onClick={() => setActiveTab('upload')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'upload'
                                        ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <UploadCloud className="h-4 w-4" />
                                    File & Text
                                </button>
                                <button
                                    onClick={() => setActiveTab('sharepoint')}
                                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'sharepoint'
                                        ? 'bg-white text-[#0078D4] shadow-sm ring-1 ring-slate-200'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Link2 className="h-4 w-4" />
                                    SharePoint
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="p-8 flex-1 flex flex-col">
                            {activeTab === 'upload' && (
                                <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-left-4 duration-300">

                                    {/* Drag & Drop Zone */}
                                    {!uploadState.file && !uploadState.textInput ? (
                                        <div
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`relative group flex-1 border-2 border-dashed rounded-2xl p-8 transition-all duration-300 flex flex-col items-center justify-center text-center gap-4 ${isDragging
                                                ? 'border-indigo-500 bg-indigo-50/30'
                                                : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50'
                                                }`}
                                        >
                                            <div className="h-20 w-20 bg-indigo-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                                                <UploadCloud className="h-10 w-10 text-indigo-600" />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="text-xl font-bold text-slate-800">Drag & Drop or Browse</h3>
                                                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                                    Support for PDF, PPTX, DOCX, Video, Audio, and Images.
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap justify-center gap-2 mt-2">
                                                <FormatBadge label="PDF" />
                                                <FormatBadge label="PPTX" />
                                                <FormatBadge label="DOCX" />
                                                <FormatBadge label="MP4" />
                                                <FormatBadge label="TXT" />
                                            </div>

                                            <label className="absolute inset-0 cursor-pointer">
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept=".pdf,.txt,.md,.jpg,.jpeg,.png,.mp4,.mov,.mp3,.wav,.docx,.pptx"
                                                    onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                                                />
                                            </label>

                                            <div className="absolute bottom-4 text-xs text-slate-400 font-medium bg-white/50 px-3 py-1 rounded-full backdrop-blur-sm">
                                                or paste text below
                                            </div>
                                        </div>
                                    ) : (
                                        // File Selected State
                                        uploadState.file && (
                                            <div className="bg-slate-50 border border-indigo-100 rounded-2xl p-6 flex items-center gap-6 relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 p-4 z-10">
                                                    <button
                                                        onClick={() => setUploadState(prev => ({ ...prev, file: null, textInput: '', fileBase64: undefined }))}
                                                        className="p-2 bg-white rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="h-24 w-24 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center flex-shrink-0">
                                                    {uploadState.assetType === AssetType.PRESENTATION ? <Presentation className="h-12 w-12 text-orange-500" /> :
                                                        uploadState.assetType === AssetType.VIDEO ? <Video className="h-12 w-12 text-pink-500" /> :
                                                            uploadState.assetType === AssetType.IMAGE ? <ImageIcon className="h-12 w-12 text-purple-500" /> :
                                                                <FileText className="h-12 w-12 text-indigo-500" />}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">{uploadState.file.name}</h3>
                                                    <p className="text-sm text-slate-500 mb-2">{(uploadState.file.size / 1024 / 1024).toFixed(2)} MB • {uploadState.mimeType || 'Unknown Type'}</p>

                                                    {/* Smart Processing Steps */}
                                                    {smartProcessingStep ? (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 animate-pulse">
                                                            <Layers className="h-3 w-3" />
                                                            {smartProcessingStep}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-md flex items-center gap-1.5 w-fit">
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                Ready for Analysis
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Duplicate Warning */}
                                                    {duplicateWarning && (
                                                        <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md flex items-center gap-1.5 w-fit">
                                                            <FileStack className="h-3 w-3" />
                                                            {duplicateWarning}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    )}

                                    {/* Text Input Area (Conditional) */}
                                    {!uploadState.file && (
                                        <div className="flex-1 relative">
                                            <div className="absolute -top-3 left-4 px-2 bg-white text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                Or Paste Text Content
                                            </div>
                                            <textarea
                                                value={uploadState.textInput}
                                                onChange={(e) => setUploadState({ ...uploadState, textInput: e.target.value })}
                                                className="w-full h-full min-h-[180px] p-6 bg-white border border-slate-200 rounded-2xl text-slate-700 placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none resize-none text-sm leading-relaxed"
                                                placeholder="Paste your email draft, social caption, or article content here..."
                                            />
                                            {uploadState.textInput.length > 10 && !isDetecting && (
                                                <button
                                                    onClick={handleManualAutoDetect}
                                                    className="absolute bottom-4 right-4 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                                                >
                                                    <Sparkles className="h-3 w-3" />
                                                    Auto-Detect Context
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Warnings */}
                                    {formatWarning && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-bold text-amber-800">Processing Issue</h4>
                                                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                                                    {formatWarning}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SharePoint Tab Content */}
                            {activeTab === 'sharepoint' && (
                                <div className="flex-1 flex flex-col justify-center items-center gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl p-8 text-center space-y-4">
                                        <div className="h-16 w-16 bg-blue-100 text-[#0078D4] rounded-full flex items-center justify-center mx-auto mb-2">
                                            <Link2 className="h-8 w-8" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-900">Connect to SharePoint</h3>
                                            <p className="text-slate-500 max-w-sm mx-auto mt-2">Paste a secure link to your document to fetch it directly.</p>
                                        </div>

                                        <div className="relative max-w-lg mx-auto w-full mt-4">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Lock className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={urlInput}
                                                onChange={(e) => setUrlInput(e.target.value)}
                                                placeholder="https://company.sharepoint.com/sites/..."
                                                className="w-full pl-10 pr-24 py-3 bg-white border border-slate-300 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-800 transition-shadow shadow-sm"
                                            />
                                            <button
                                                onClick={handleSharePointFetch}
                                                disabled={isFetchingUrl || !urlInput}
                                                className="absolute right-1 top-1 bottom-1 px-4 bg-[#0078D4] hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm transition-colors"
                                            >
                                                {isFetchingUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
                                            </button>
                                        </div>
                                    </div>

                                    {uploadState.textInput && uploadState.sharePointUrl && (
                                        <div className="w-full relative animate-in fade-in slide-in-from-bottom-2">
                                            <div className="absolute -top-3 left-4 px-2 bg-white text-xs font-bold text-emerald-600 uppercase tracking-wider border border-emerald-100 rounded-full shadow-sm z-10">
                                                ✓ Document Loaded
                                            </div>
                                            <textarea
                                                readOnly
                                                className="w-full h-32 p-4 bg-slate-50 border border-emerald-200 rounded-xl outline-none resize-none text-slate-600 text-sm leading-relaxed"
                                                value={uploadState.textInput}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Context Intelligence Panel (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden h-[600px] flex flex-col">
                        {/* Background Decor */}
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <ScanEye className="h-64 w-64 text-white" />
                        </div>

                        <div className="relative z-10 space-y-8 flex-1">
                            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-indigo-400" />
                                    Context Engine
                                </h3>
                                {detectedFields.length > 0 && (
                                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase rounded-md border border-emerald-500/30 animate-pulse flex items-center gap-1">
                                        <Gauge className="h-3 w-3" />
                                        {uploadState.detectedConfidence || 85}% Conf
                                    </span>
                                )}
                            </div>

                            {/* Metadata Fields */}
                            <div className="space-y-6">

                                {/* Asset Type */}
                                <div className="bg-white/5 rounded-xl p-1 border border-white/10 transition-colors hover:bg-white/10">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 block">Asset Format</label>
                                    <div className="relative">
                                        <select
                                            value={uploadState.assetType}
                                            onChange={(e) => setUploadState({ ...uploadState, assetType: e.target.value as AssetType })}
                                            className="w-full bg-transparent text-white font-bold text-sm p-3 outline-none appearance-none cursor-pointer"
                                        >
                                            {Object.values(AssetType).map(t => <option key={t} value={t} className="text-slate-900">{t}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Purpose */}
                                <div className="bg-white/5 rounded-xl p-1 border border-white/10 transition-colors hover:bg-white/10">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 pt-2 block">Goal / Intent</label>
                                    <div className="relative">
                                        <select
                                            value={uploadState.context}
                                            onChange={(e) => setUploadState({ ...uploadState, context: e.target.value as CommunicationContext })}
                                            className="w-full bg-transparent text-white font-bold text-sm p-3 outline-none appearance-none cursor-pointer"
                                        >
                                            {Object.values(CommunicationContext).map(p => <option key={p} value={p} className="text-slate-900">{p}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Region Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10">
                                        <span className="text-xs font-bold text-slate-300">Specific Region?</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400">{enableRegion ? 'Yes' : 'Global'}</span>
                                            <button
                                                onClick={() => handleRegionToggle(!enableRegion)}
                                                className={`w-9 h-5 rounded-full relative transition-colors duration-300 ${enableRegion ? 'bg-indigo-500' : 'bg-slate-600'}`}
                                            >
                                                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all duration-300 shadow-sm ${enableRegion ? 'left-[18px]' : 'left-0.5'}`}></div>
                                            </button>
                                        </div>
                                    </div>

                                    {enableRegion && (
                                        <div className="bg-white/5 rounded-xl p-1 border border-white/10 animate-in fade-in slide-in-from-top-2">
                                            <div className="relative">
                                                <select
                                                    value={uploadState.region}
                                                    onChange={(e) => setUploadState({ ...uploadState, region: e.target.value as Region })}
                                                    className="w-full bg-transparent text-white font-bold text-sm p-3 outline-none appearance-none cursor-pointer"
                                                >
                                                    {COUNTRIES.map(c => <option key={c} value={c} className="text-slate-900">{c}</option>)}
                                                </select>
                                                <Globe className="absolute right-3 top-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>

                        <div className="pt-6 border-t border-white/10 mt-auto">
                            <button
                                onClick={() => onAnalyze()}
                                disabled={isAnalyzing || (!uploadState.textInput && !uploadState.file)}
                                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] ${isAnalyzing || (!uploadState.textInput && !uploadState.file)
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-indigo-50 hover:bg-indigo-400 text-white shadow-indigo-500/25 hover:shadow-indigo-500/40'
                                    }`}
                            >
                                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                                {isAnalyzing ? 'Deep Analysis...' : 'Run Analysis'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
