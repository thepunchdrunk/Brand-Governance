
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, AlertTriangle, XCircle, ChevronRight,
    Copy, Check, Layout, Globe, Shield, RefreshCw, Zap, Maximize2, ArrowLeft
} from 'lucide-react';
import { AnalysisResult, BrandSettings, Issue, AssetType, CommunicationContext } from '../types';
import { translateContent } from '../services/gemini';
import { VisualAnnotationLayer } from './VisualAnnotationLayer';
import { cn } from '../utils';

// Category Color Mapping
const getCategoryColor = (category: string) => {
    switch (category) {
        case 'Brand': return { bg: 'bg-indigo-500', text: 'text-indigo-100', border: 'border-indigo-500', shadow: 'shadow-indigo-500/20' };
        case 'Compliance': return { bg: 'bg-rose-500', text: 'text-rose-100', border: 'border-rose-500', shadow: 'shadow-rose-500/20' };
        case 'Cultural': return { bg: 'bg-teal-500', text: 'text-teal-100', border: 'border-teal-500', shadow: 'shadow-teal-500/20' };
        default: return { bg: 'bg-slate-500', text: 'text-slate-100', border: 'border-slate-500', shadow: 'shadow-slate-500/20' };
    }
};

interface ScoreDashboardProps {
    result: AnalysisResult;
    onReset: () => void;
    brandSettings: BrandSettings;
    originalText?: string;
    assetType?: AssetType;
    context: CommunicationContext;
    fileUrl?: string;
    htmlContent?: string; // New prop for DOCX
    mimeType?: string;    // New prop for robust rendering
    visualSlides?: { data: string; mimeType: string }[]; // Extracted slide/page images
}

// Score Ring Component
const ScoreRing = ({ score }: { score: number }) => {
    const radius = 30;
    const stroke = 4;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-20 h-20">
            <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
                <circle
                    stroke="currentColor"
                    fill="transparent"
                    strokeWidth={stroke}
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    className="text-white/10"
                />
                <circle
                    stroke="currentColor"
                    fill="transparent"
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset, transition: "stroke-dashoffset 0.5s ease-in-out" }}
                    strokeLinecap="round"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    className={cn(
                        score === 100 ? "text-emerald-400" :
                            score >= 50 ? "text-amber-400" : "text-red-400"
                    )}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-xl font-black",
                    score === 100 ? "text-emerald-400" :
                        score >= 50 ? "text-amber-400" : "text-red-400"
                )}>
                    {score}
                </span>
            </div>
        </div>
    );
};

export const ScoreDashboard: React.FC<ScoreDashboardProps> = ({ result, onReset, brandSettings, originalText = "", assetType = AssetType.DOCUMENT, context, fileUrl, htmlContent, mimeType, visualSlides }) => {
    // ... existing hooks ...
    const [activeFilter, setActiveFilter] = useState<'Brand' | 'Compliance' | 'Cultural'>('Brand');
    const [fixedIssues, setFixedIssues] = useState<Set<string>>(new Set());
    const [hoveredIssue, setHoveredIssue] = useState<string | null>(null);

    const handleFix = (issueId: string) => {
        setFixedIssues(prev => {
            const newSet = new Set(prev);
            if (newSet.has(issueId)) newSet.delete(issueId);
            else newSet.add(issueId);
            return newSet;
        });
    };

    // Deductive Scoring Model (100% = No Issues)
    const PENALTY_VALUES = { 'High': 20, 'Medium': 10, 'Low': 5 };

    // Derived State: Dynamic Score
    const boostedScore = React.useMemo(() => {
        // Start perfect, deduct for every ACTIVE issue
        let score = 100;
        const activeIssues = result.issues.filter(i => !fixedIssues.has(i.id));

        activeIssues.forEach(issue => {
            score -= PENALTY_VALUES[issue.severity as keyof typeof PENALTY_VALUES] || 5;
        });

        return Math.max(0, score); // Floor at 0
    }, [fixedIssues, result.issues]);

    // Derived State: Dynamic Safety Status (Zero Tolerance)
    const currentSafetyStatus = React.useMemo(() => {
        const remainingIssues = result.issues.filter(i => !fixedIssues.has(i.id));
        const hasBlocking = remainingIssues.some(i => i.blocking);

        // 1. Unsafe if Blocking OR Score < 50
        if (hasBlocking || boostedScore < 50) return 'Unsafe';

        // 2. Safe ONLY if Perfect Score (100)
        if (boostedScore === 100) return 'Safe';

        // 3. Otherwise Caution (50-99)
        return 'Caution';
    }, [result.issues, fixedIssues, boostedScore]);



    const filteredIssues = result.issues.filter(i => i.category === activeFilter);

    // Sort: Blocking first, then High severity
    const sortedIssues = [...filteredIssues].sort((a, b) => {
        if (a.blocking && !b.blocking) return -1;
        if (!a.blocking && b.blocking) return 1;
        return 0; // Keep stable otherwise
    });

    // Helper to determine if we should show visual layer
    const showVisualLayer = React.useMemo(() => {
        return !!(fileUrl || htmlContent);
    }, [fileUrl, htmlContent]);

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 flex flex-col items-center">
            {/* BACKGROUND FX */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[100px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
            </div>

            {/* HEADER */}
            <header className="w-full max-w-7xl flex flex-col gap-6 mb-8 relative z-10">
                <div className="flex justify-between items-center">
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                    >
                        <ArrowLeft className="h-4 w-4" /> Upload New
                    </button>

                    <div className="flex items-center gap-6">
                        {/* BRAND ALIGNMENT SCORE CARD */}
                        <div className="flex items-center gap-4 px-6 py-2 rounded-2xl bg-slate-900/50 border border-white/5 backdrop-blur shadow-2xl">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Brand Alignment</span>
                                <span className="text-xs font-medium text-slate-500">Score</span>
                            </div>
                            <ScoreRing score={boostedScore || 0} />
                        </div>

                        {/* OVERALL SAFETY STATUS BANNER */}
                        <div className={cn(
                            "px-6 py-4 rounded-2xl border backdrop-blur-md flex items-center gap-3 shadow-2xl transition-all duration-500",
                            currentSafetyStatus === 'Unsafe' ? "bg-red-500/10 border-red-500 text-red-100 shadow-red-900/20" :
                                currentSafetyStatus === 'Caution' ? "bg-amber-500/10 border-amber-500 text-amber-100 shadow-amber-900/20" :
                                    "bg-emerald-500/10 border-emerald-500 text-emerald-100 shadow-emerald-900/20"
                        )}>
                            {currentSafetyStatus === 'Unsafe' ? <XCircle className="h-8 w-8" /> :
                                currentSafetyStatus === 'Caution' ? <AlertTriangle className="h-8 w-8" /> :
                                    <CheckCircle2 className="h-8 w-8" />}

                            <div className="flex flex-col">
                                <span className="font-black text-xs uppercase tracking-widest opacity-70">Publish Status</span>
                                <span className="font-black text-lg uppercase tracking-wider">
                                    {currentSafetyStatus === 'Safe' ? "Ready to Publish" :
                                        currentSafetyStatus === 'Caution' ? "Review Required" : "Action Required"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN SPLIT VIEW */}
            <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-280px)] relative z-10">

                {/* LEFT: CONTENT VIEWER (2/3 width) */}
                <section className="lg:col-span-2 bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/10 overflow-hidden flex flex-col relative group shadow-2xl">
                    <div className="absolute inset-0 bg-grid-white/[0.02] pointer-events-none" />

                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/40">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Maximize2 className="h-3 w-3" /> {assetType} Analysis View
                        </span>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                                context === CommunicationContext.NOT_SURE ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                            )}>
                                {context} Mode
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative bg-black/20">
                        {/* VISUAL MODE CHECK - Now permissive based on content presence */}
                        {showVisualLayer ? (
                            fileUrl || htmlContent ? (
                                <VisualAnnotationLayer
                                    assetType={assetType as AssetType}
                                    src={fileUrl || ""}
                                    issues={filteredIssues}
                                    selectedIssueId={hoveredIssue || undefined}
                                    onIssueSelect={(id) => {
                                        setHoveredIssue(id);
                                    }}
                                    htmlContent={htmlContent}
                                    mimeType={mimeType}
                                    visualSlides={visualSlides}
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                    <p>Visual preview unavailable (Missing File URL)</p>
                                </div>
                            )
                        ) : (
                            /* TEXT MODE */
                            <div className="h-full overflow-y-auto p-8 font-mono text-sm leading-relaxed scrollbar-hide text-slate-300">
                                <p className="whitespace-pre-wrap max-w-2xl mx-auto">{originalText}</p>
                            </div>
                        )}
                    </div>
                </section >

                {/* RIGHT: UNIFIED ISSUE STREAM (1/3 width) */}
                < section className="flex flex-col h-full overflow-hidden bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl" >

                    {/* FILTER TABS */}
                    < div className="flex p-1 gap-1 border-b border-white/5 bg-black/20 overflow-x-auto scrollbar-hide" >
                        {
                            ['Brand', 'Compliance', 'Cultural'].map((tab) => {
                                const colors = getCategoryColor(tab);
                                const isActive = activeFilter === tab;
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveFilter(tab as any)}
                                        className={cn(
                                            "flex-1 min-w-[80px] py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border border-transparent",
                                            isActive ? cn(colors.bg, "text-white border-white/20") :
                                                "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                                        )}
                                    >
                                        {tab}
                                    </button>
                                );
                            })
                        }
                    </div >

                    {/* METRICS HEADER */}
                    < div className="px-5 py-3 border-b border-white/5 bg-white/5 flex justify-between items-center" >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {activeFilter} Issues
                        </span>
                        <span className="text-xs font-mono font-bold text-white">
                            {sortedIssues.filter(i => !fixedIssues.has(i.id)).length} / {sortedIssues.length}
                        </span>
                    </div >

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                        {sortedIssues.map((issue, index) => (
                            <motion.div
                                key={issue.id}
                                layoutId={issue.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "rounded-lg border transition-all cursor-pointer relative group overflow-hidden",
                                    hoveredIssue === issue.id ? "border-indigo-500/50 bg-white/10 translate-x-1" : "bg-black/40 border-white/5",
                                    fixedIssues.has(issue.id) ? "opacity-40 grayscale" : ""
                                )}
                                onMouseEnter={() => setHoveredIssue(issue.id)}
                                onMouseLeave={() => setHoveredIssue(null)}
                                onClick={() => setHoveredIssue(issue.id)}
                            >
                                {/* HEADER */}
                                <div className="p-3 border-b border-white/5 flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            {/* NUMBER BADGE */}
                                            <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                                                issue.severity === 'High' ? "bg-red-500/20 text-red-300" :
                                                    issue.severity === 'Medium' ? "bg-amber-500/20 text-amber-300" :
                                                        "bg-indigo-500/20 text-indigo-300"
                                            )}>
                                                #{index + 1}
                                            </span>

                                            {issue.blocking ? (
                                                <span className="px-1.5 py-0.5 rounded-sm bg-red-500 text-white text-[9px] font-bold uppercase tracking-wider">BLOCKING</span>
                                            ) : (
                                                <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[9px] font-bold uppercase tracking-wider">ADVISORY</span>
                                            )}
                                            <span className="text-[10px] font-bold text-slate-500 uppercase truncate">{issue.category}</span>
                                        </div>
                                        <h4 className="font-bold text-white text-sm leading-tight truncate">{issue.description}</h4>
                                    </div>
                                    <div className={cn(
                                        "w-6 h-6 rounded flex items-center justify-center shrink-0",
                                        issue.category === 'Brand' ? "bg-indigo-500/20 text-indigo-400" :
                                            issue.category === 'Compliance' ? "bg-amber-500/20 text-amber-400" :
                                                "bg-purple-500/20 text-purple-400"
                                    )}>
                                        {issue.category === 'Brand' ? <Shield className="h-3 w-3" /> :
                                            issue.category === 'Compliance' ? <AlertTriangle className="h-3 w-3" /> :
                                                <Globe className="h-3 w-3" />}
                                    </div>
                                </div>

                                {/* DETAILS */}
                                <div className="p-3">
                                    {/* Recommended Action Card */}
                                    <div className="bg-slate-800/80 rounded-lg p-3 border border-white/5 relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />

                                        <div className="flex items-center gap-2 mb-2">
                                            <Zap className="h-3 w-3 text-emerald-400" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-100/70">Recommended Fix</span>
                                        </div>

                                        <p className="text-xs text-slate-200 leading-relaxed font-medium pl-1">
                                            {issue.fix}
                                        </p>
                                    </div>
                                </div>

                                {/* ACTION FOOTER */}
                                <div className="px-3 py-2 bg-white/5 border-t border-white/5 flex justify-end">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleFix(issue.id); }}
                                        className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors",
                                            fixedIssues.has(issue.id) ? "text-emerald-400" : "text-indigo-300 hover:text-white"
                                        )}
                                    >
                                        {fixedIssues.has(issue.id) ? <><Check className="h-3 w-3" /> Resolved</> : "Resolve"}
                                    </button>
                                </div>
                            </motion.div>
                        ))}

                        {sortedIssues.length === 0 && (
                            <div className="py-12 text-center flex flex-col items-center opacity-50">
                                <CheckCircle2 className="h-8 w-8 mb-2" />
                                <span className="text-xs font-bold uppercase tracking-widest">No Issues Found</span>
                            </div>
                        )}
                    </div>
                </section >
            </main >
        </div >
    );
};
