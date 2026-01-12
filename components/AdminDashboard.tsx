
import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie
} from 'recharts';
import {
    TrendingUp, ShieldAlert, Target, FileText, Activity,
    Cpu, Sparkles, ArrowRight, Lightbulb, AlertCircle
} from 'lucide-react';
import { HistoryItem } from '../types';

interface AdminDashboardProps {
    history: HistoryItem[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ history }) => {
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

    // --- ANALYTICS ENGINE ---
    const rawData = useMemo(() => {
        const limit = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        return history.slice(0, limit * 2);
    }, [history, timeRange]);

    // --- CORE KPIs ---
    const kpis = useMemo(() => {
        const total = rawData.length;
        if (total === 0) return { passRate: 0, totalAnalyzed: 0, blockers: 0, timeSaved: 0 };

        const safeCount = rawData.filter(h => h.safetyStatus === 'Safe').length;
        const blockers = rawData.filter(h => h.safetyStatus === 'Unsafe').length;
        const passRate = Math.round((safeCount / total) * 100);
        const timeSaved = Math.round(total * 0.75); // 45 mins per asset

        return { passRate, totalAnalyzed: total, blockers, timeSaved };
    }, [rawData]);

    // --- ASSET TYPE PERFORMANCE (Replacing Department) ---
    const assetTypePerformance = useMemo(() => {
        const typeMap: Record<string, { total: number; safe: number }> = {};
        rawData.forEach(h => {
            const assetType = h.type || 'Unknown';
            if (!typeMap[assetType]) typeMap[assetType] = { total: 0, safe: 0 };
            typeMap[assetType].total++;
            if (h.safetyStatus === 'Safe') typeMap[assetType].safe++;
        });

        return Object.entries(typeMap)
            .map(([name, data]) => ({
                name: name.length > 15 ? name.substring(0, 15) + '...' : name,
                fullName: name,
                rate: data.total > 0 ? Math.round((data.safe / data.total) * 100) : 0,
                volume: data.total
            }))
            .sort((a, b) => a.rate - b.rate) // Worst first
            .slice(0, 6); // Top 6 for readability
    }, [rawData]);

    const worstAssetType = assetTypePerformance[0];

    // --- CATEGORY BREAKDOWN (Brand/Compliance/Cultural) ---
    const categoryBreakdown = useMemo(() => {
        const categories = { Brand: 0, Compliance: 0, Cultural: 0 };
        rawData.forEach(h => {
            h.topIssues?.forEach(issue => {
                const lower = issue.toLowerCase();
                if (lower.includes('tone') || lower.includes('voice') || lower.includes('font') || lower.includes('logo') || lower.includes('style')) {
                    categories.Brand++;
                } else if (lower.includes('banned') || lower.includes('claim') || lower.includes('legal') || lower.includes('verified') || lower.includes('policy')) {
                    categories.Compliance++;
                } else {
                    categories.Cultural++;
                }
            });
        });
        return [
            { name: 'Brand', value: categories.Brand, color: '#6366f1' },
            { name: 'Compliance', value: categories.Compliance, color: '#f59e0b' },
            { name: 'Cultural', value: categories.Cultural, color: '#10b981' },
        ].filter(c => c.value > 0);
    }, [rawData]);

    // --- TOP RECURRING ISSUES ---
    const topIssues = useMemo(() => {
        const issueCounts: Record<string, number> = {};
        rawData.forEach(h => {
            h.topIssues?.forEach(issue => {
                issueCounts[issue] = (issueCounts[issue] || 0) + 1;
            });
        });
        return Object.entries(issueCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([name]) => name);
    }, [rawData]);

    // --- AI INSIGHT (Action-Oriented) ---
    const insight = useMemo(() => {
        if (kpis.passRate < 50) return {
            title: "Immediate Action Required",
            text: `Only ${kpis.passRate}% of assets are passing. Focus on updating guidelines for your most common issues to quickly improve this rate.`,
            color: "text-red-400"
        };
        if (worstAssetType && worstAssetType.rate < 60) return {
            title: "Focus Area Identified",
            text: `"${worstAssetType.fullName}" has the lowest pass rate at ${worstAssetType.rate}%. Consider creating a specific template or checklist for this asset type.`,
            color: "text-amber-400"
        };
        return {
            title: "System Healthy",
            text: "Your brand governance is performing well. To reach 100%, address the minor issues listed in the 'Recommended Actions' section.",
            color: "text-emerald-400"
        };
    }, [kpis, worstAssetType]);


    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-12 font-sans text-slate-100 animate-in fade-in duration-700">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-10 border-b border-indigo-500/30 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Cpu className="h-6 w-6" /></div>
                        <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">ANALYTICS</h2>
                    </div>
                    <p className="text-slate-500 font-medium tracking-wide">Brand Governance Intelligence</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-white/10 mt-4 md:mt-0">
                    {['7d', '30d', '90d'].map(range => (
                        <button key={range} onClick={() => setTimeRange(range as any)}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${timeRange === range ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                            {range.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* ROW 1: AI INSIGHT */}
            <div className="mb-10 relative group overflow-hidden rounded-3xl bg-slate-900/50 border border-white/10 p-8 backdrop-blur-xl">
                <div className="absolute top-0 right-0 p-32 bg-indigo-500/10 blur-[100px] rounded-full" />
                <div className="flex items-start gap-6 relative z-10">
                    <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl"><Sparkles className="h-8 w-8 text-white" /></div>
                    <div>
                        <span className={`text-sm font-bold uppercase tracking-widest ${insight.color}`}>{insight.title}</span>
                        <h3 className="text-xl font-medium text-slate-200 leading-relaxed max-w-3xl mt-2">{insight.text}</h3>
                    </div>
                </div>
            </div>

            {/* ROW 2: KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <MetricCard label="Pass Rate" value={`${kpis.passRate}%`} icon={Target} color="indigo" />
                <MetricCard label="Assets Analyzed" value={kpis.totalAnalyzed.toString()} icon={FileText} color="blue" />
                <MetricCard label="Blocked from Publish" value={kpis.blockers.toString()} icon={ShieldAlert} color="red" sub="Critical issues found" />
                <MetricCard label="Review Time Saved" value={`${kpis.timeSaved}h`} icon={Activity} color="emerald" sub="vs. Manual Process" />
            </div>

            {/* ROW 3: CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Asset Type Performance */}
                <div className="lg:col-span-2 bg-slate-900/50 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-400" /> Pass Rate by Asset Type</h3>
                    {assetTypePerformance.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={assetTypePerformance} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal vertical={false} />
                                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis dataKey="name" type="category" width={110} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} formatter={(value: number) => [`${value}%`, 'Pass Rate']} />
                                <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18}>
                                    {assetTypePerformance.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-slate-500 text-center py-12">No asset data available.</p>}
                </div>

                {/* Issue Category Breakdown */}
                <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                    <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2"><AlertCircle className="h-5 w-5 text-amber-400" /> Issue Breakdown</h3>
                    {categoryBreakdown.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={150}>
                                <PieChart>
                                    <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3}>
                                        {categoryBreakdown.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#94a3b8' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Simple Legend */}
                            <div className="flex justify-center gap-4 mt-2">
                                {categoryBreakdown.map(cat => (
                                    <div key={cat.name} className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                        <span className="text-xs text-slate-400">{cat.name}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : <p className="text-slate-500 text-center py-8 text-sm">No issue data available.</p>}
                </div>
            </div>

            {/* ROW 4: RECOMMENDED ACTIONS */}
            <div className="mt-10 bg-slate-900/50 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-400" /> Recommended Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {topIssues.length > 0 ? topIssues.map((issue, idx) => (
                        <div key={idx} className="group flex items-center p-4 rounded-2xl bg-white/5 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 transition-all cursor-pointer">
                            <span className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 font-bold text-sm flex items-center justify-center mr-4 group-hover:bg-indigo-500 group-hover:text-white shrink-0">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-300 text-sm group-hover:text-white truncate">Update guidelines for:</p>
                                <p className="text-xs text-slate-500 group-hover:text-indigo-300 truncate">"{issue}"</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-indigo-400 transition-all shrink-0" />
                        </div>
                    )) : <div className="col-span-full text-center text-slate-500 py-8">No actions required at this time.</div>}
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, icon: Icon, color, sub }: any) => {
    const colors: Record<string, string> = { indigo: "text-indigo-400 bg-indigo-500/10", emerald: "text-emerald-400 bg-emerald-500/10", red: "text-red-400 bg-red-500/10", blue: "text-blue-400 bg-blue-500/10" };
    const theme = colors[color] || colors.indigo;
    return (
        <div className="bg-slate-900/50 border border-white/5 p-5 rounded-2xl backdrop-blur-sm hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
                <div className={`p-1.5 rounded-lg ${theme}`}><Icon className="h-4 w-4" /></div>
            </div>
            <span className="text-2xl font-bold text-white">{value}</span>
            {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
        </div>
    );
};
