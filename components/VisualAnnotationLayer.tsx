import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Issue, AssetType } from '../types';
import { Play, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF Worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface VisualAnnotationLayerProps {
    assetType: AssetType;
    src: string;
    issues: Issue[];
    selectedIssueId?: string;
    onIssueSelect: (id: string) => void;
    className?: string;
    htmlContent?: string;
    mimeType?: string;
    visualSlides?: { data: string; mimeType: string }[];
}

export const VisualAnnotationLayer: React.FC<VisualAnnotationLayerProps> = ({
    assetType,
    src,
    issues,
    selectedIssueId,
    onIssueSelect,
    className,
    htmlContent,
    mimeType,
    visualSlides
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null); // For Horizontal PDF Scrolling
    const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map()); // Refs for each PDF page
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [scale, setScale] = useState(1);
    const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
    const [hoveredPageIndex, setHoveredPageIndex] = useState<number | null>(null);

    // PDF State
    const [numPages, setNumPages] = useState<number>(0);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    // Determine Render Mode
    const isVideo = assetType === AssetType.VIDEO || mimeType?.startsWith('video/');
    const isPDF = mimeType === 'application/pdf';
    const hasVisualSlides = visualSlides && visualSlides.length > 0;
    // Use carousel for PDF and PPTX with visual slides
    const useCarousel = isPDF || hasVisualSlides;
    const isDoc = htmlContent || assetType === AssetType.DOCUMENT || assetType === AssetType.PRESENTATION || isPDF;

    // DIAGNOSTIC LOGGING
    useEffect(() => {
        console.log("=== VISUAL ANNOTATION DIAGNOSTIC ===");
        console.log("Asset Type:", assetType);
        console.log("MIME Type:", mimeType);
        console.log("Is Video:", isVideo);
        console.log("Is PDF:", isPDF);
        console.log("Has Visual Slides:", hasVisualSlides, visualSlides?.length || 0);
        console.log("Use Carousel:", useCarousel);
        console.log("Is Doc:", isDoc);
        console.log("Total Issues:", issues.length);

        issues.forEach((issue, idx) => {
            console.log(`Issue #${idx + 1}:`, {
                id: issue.id,
                category: issue.category,
                description: issue.description.substring(0, 50),
                hasBoundingBox: !!issue.boundingBox,
                boundingBox: issue.boundingBox,
                page_number: issue.page_number,
                timestamp: issue.timestamp
            });
        });

        const issuesWithBoxes = issues.filter(i => i.boundingBox);
        console.log(`Issues WITH bounding boxes: ${issuesWithBoxes.length}/${issues.length}`);
        console.log("=====================================");
    }, [issues, assetType, mimeType, visualSlides, isPDF, hasVisualSlides, useCarousel, isDoc]);

    // --- ZOOM & PAN HANDLERS ---
    const handleWheel = (e: React.WheelEvent) => {
        // Only zoom if NOT a document
        if (isDoc) return;

        e.stopPropagation();
        const delta = -e.deltaY / 1000;
        setScale(prev => Math.min(Math.max(1, prev + delta), 4));
    };

    // --- NAVIGATION HANDLERS (PDF) ---
    const scrollByPage = (direction: 'left' | 'right') => {
        if (!scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const scrollAmount = container.clientWidth; // Scroll by viewport width

        container.scrollBy({
            left: direction === 'right' ? scrollAmount : -scrollAmount,
            behavior: 'smooth'
        });
    };

    // --- VIDEO HANDLING ---
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleSeekToIssue = async (issue: Issue) => {
        if (isVideo && issue.timestamp && videoRef.current) {
            const vid = videoRef.current;
            vid.currentTime = issue.timestamp;
            vid.pause();
            await new Promise(r => setTimeout(r, 200));
        }
        onIssueSelect(issue.id);
    };

    // Watch for selection changes (External Clicking) - SCROLL TO PAGE
    useEffect(() => {
        if (selectedIssueId) {
            const issue = issues.find(i => i.id === selectedIssueId);
            if (issue) {
                if (isVideo) {
                    handleSeekToIssue(issue);
                } else if (useCarousel) {
                    // Scroll to the page/slide containing this issue (works for PDF and PPTX)
                    const pageNum = issue.page_number || 1;
                    const pageEl = pageRefs.current.get(pageNum);
                    if (pageEl) {
                        pageEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
                        console.log(`Scrolling to slide/page ${pageNum}`);
                    }
                }
            }
        }
    }, [selectedIssueId, assetType, isVideo, issues, useCarousel]);

    // --- RENDER ---
    return (
        <div
            ref={containerRef}
            className={cn("relative w-full h-full bg-slate-950 overflow-hidden group select-none flex items-center justify-center font-sans", className)}
            onWheel={handleWheel}
        >

            {isDoc ? (
                <div className="w-full h-full flex justify-center bg-slate-900/50 relative z-10 overflow-hidden">
                    {useCarousel ? (
                        // CAROUSEL MODE (PDF native / PPTX visual slides)
                        <div className="relative w-full h-full flex items-center">

                            {/* NAVIGATION BUTTONS */}
                            <button
                                onClick={() => scrollByPage('left')}
                                className="absolute left-4 z-[200] p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => scrollByPage('right')}
                                className="absolute right-4 z-[200] p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>

                            {isPDF ? (
                                // PDF Native Renderer
                                <Document
                                    file={src}
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-8 px-[10vw] py-24 items-center h-full w-full scrollbar-hide"
                                    inputRef={scrollContainerRef}
                                    loading={<div className="text-white m-auto">Loading PDF...</div>}
                                    error={<div className="text-red-500 m-auto p-4 bg-white/10 rounded">Failed to render PDF.</div>}
                                >
                                    {Array.from(new Array(numPages), (_, index) => (
                                        <div
                                            key={`page_wrapper_${index + 1}`}
                                            ref={(el) => { if (el) pageRefs.current.set(index + 1, el); }}
                                            className="relative shadow-2xl snap-center shrink-0 flex items-center justify-center p-2 group/page"
                                        >
                                            {/* PAGE NUMBER BADGE */}
                                            <div className="absolute top-4 left-4 z-[150] bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                                                Page {index + 1}
                                            </div>

                                            <div className="relative">
                                                <Page
                                                    key={`page_${index + 1}`}
                                                    pageNumber={index + 1}
                                                    renderTextLayer={false}
                                                    renderAnnotationLayer={false}
                                                    className="bg-white"
                                                    width={500}
                                                />

                                                {/* ANNOTATION LAYER */}
                                                <div className="absolute inset-0 w-full h-full pointer-events-none z-[100]">
                                                    {issues.map((issue) => {
                                                        const isPageMatch = issue.page_number === index + 1 || (!issue.page_number && index === 0);
                                                        if (!isPageMatch) return null;
                                                        const globalIndex = issues.findIndex(x => x.id === issue.id);
                                                        const box = issue.boundingBox;
                                                        if (!box) return null;
                                                        const centerX = box.x + (box.width / 2);
                                                        const centerY = box.y + (box.height / 2);
                                                        const isSelected = selectedIssueId === issue.id;
                                                        return (
                                                            <div
                                                                key={issue.id}
                                                                style={{ left: `${centerX}%`, top: `${centerY}%` }}
                                                                className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer pointer-events-auto z-[101]"
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onIssueSelect(issue.id); }}
                                                                onMouseEnter={() => setHoveredMarkerId(issue.id)}
                                                                onMouseLeave={() => setHoveredMarkerId(null)}
                                                                title={`${issue.severity} Severity: ${issue.description}`}
                                                            >
                                                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 relative", isSelected ? "ring-2 ring-offset-1 ring-blue-500 scale-125" : "", issue.severity === 'High' ? "bg-red-500 text-white" : issue.severity === 'Medium' ? "bg-amber-500 text-white" : "bg-blue-500 text-white")}>
                                                                    <span className="text-[10px] font-bold">{globalIndex + 1}</span>
                                                                </div>

                                                                {/* Hover Tooltip */}
                                                                <AnimatePresence>
                                                                    {hoveredMarkerId === issue.id && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                                                            animate={{ opacity: 1, y: -25, scale: 1 }}
                                                                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                                                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl z-[200]"
                                                                        >
                                                                            <div className="flex flex-col gap-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={cn("w-2 h-2 rounded-full", issue.severity === 'High' ? "bg-red-500" : issue.severity === 'Medium' ? "bg-amber-500" : "bg-blue-500")} />
                                                                                    <span className="text-xs font-bold text-white uppercase tracking-wider">{issue.severity} Severity</span>
                                                                                </div>
                                                                                <p className="text-xs text-slate-200 font-medium leading-relaxed line-clamp-3">{issue.description}</p>
                                                                            </div>
                                                                            {/* Arrow */}
                                                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900/95" />
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </Document>
                            ) : (
                                // PPTX Visual Slides Carousel
                                <div
                                    ref={scrollContainerRef}
                                    className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-8 px-[10vw] items-center h-full w-full scrollbar-hide"
                                >
                                    {visualSlides?.map((slide, index) => (
                                        <div
                                            key={`slide_${index + 1}`}
                                            ref={(el) => { if (el) pageRefs.current.set(index + 1, el); }}
                                            className="relative shadow-2xl snap-center shrink-0 flex items-center justify-center p-2 group/page"
                                        >
                                            {/* SLIDE NUMBER BADGE */}
                                            <div className="absolute top-4 left-4 z-[150] bg-black/60 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                                                Slide {index + 1}
                                            </div>

                                            <div className="relative inline-block">
                                                <img
                                                    src={`data:${slide.mimeType};base64,${slide.data}`}
                                                    alt={`Slide ${index + 1}`}
                                                    className="block max-w-[500px] max-h-[60vh] w-auto h-auto object-contain bg-white shadow-xl rounded"
                                                    onLoad={() => console.log(`PPTX Slide ${index + 1} loaded`)}
                                                    onError={(e) => console.error(`PPTX Slide ${index + 1} failed to load`, e)}
                                                />

                                                {/* ANNOTATION LAYER */}
                                                <div className="absolute inset-0 w-full h-full pointer-events-none z-[100]">
                                                    {issues.map((issue) => {
                                                        const isPageMatch = issue.page_number === index + 1 || (!issue.page_number && index === 0);
                                                        if (!isPageMatch) return null;
                                                        const globalIndex = issues.findIndex(x => x.id === issue.id);
                                                        const box = issue.boundingBox;
                                                        if (!box) return null;
                                                        const centerX = box.x + (box.width / 2);
                                                        const centerY = box.y + (box.height / 2);
                                                        const isSelected = selectedIssueId === issue.id;

                                                        console.log(`PPTX Annotation: Slide ${index + 1}, Issue ${globalIndex + 1}, Position: ${centerX}%, ${centerY}%`);

                                                        return (
                                                            <div
                                                                key={issue.id}
                                                                style={{ left: `${centerX}%`, top: `${centerY}%` }}
                                                                className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer pointer-events-auto z-[101]"
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onIssueSelect(issue.id); }}
                                                                onMouseEnter={() => setHoveredMarkerId(issue.id)}
                                                                onMouseLeave={() => setHoveredMarkerId(null)}
                                                                title={`${issue.severity} Severity: ${issue.description}`}
                                                            >
                                                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 relative", isSelected ? "ring-2 ring-offset-1 ring-blue-500 scale-125" : "", issue.severity === 'High' ? "bg-red-500 text-white" : issue.severity === 'Medium' ? "bg-amber-500 text-white" : "bg-blue-500 text-white")}>
                                                                    <span className="text-[10px] font-bold">{globalIndex + 1}</span>
                                                                </div>

                                                                {/* Hover Tooltip */}
                                                                <AnimatePresence>
                                                                    {hoveredMarkerId === issue.id && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                                                            animate={{ opacity: 1, y: -25, scale: 1 }}
                                                                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                                                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-2xl z-[200]"
                                                                        >
                                                                            <div className="flex flex-col gap-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className={cn("w-2 h-2 rounded-full", issue.severity === 'High' ? "bg-red-500" : issue.severity === 'Medium' ? "bg-amber-500" : "bg-blue-500")} />
                                                                                    <span className="text-xs font-bold text-white uppercase tracking-wider">{issue.severity} Severity</span>
                                                                                </div>
                                                                                <p className="text-xs text-slate-200 font-medium leading-relaxed line-clamp-3">{issue.description}</p>
                                                                            </div>
                                                                            {/* Arrow */}
                                                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900/95" />
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : htmlContent ? (
                        // HTML DOC (DOCX/PPTX) - Vertical Scroll
                        <div className="relative w-full h-full overflow-y-auto flex flex-col items-center p-4 gap-4">
                            {/* Notice when no visual annotations available */}
                            {issues.filter(i => i.boundingBox).length === 0 && issues.length > 0 && (
                                <div className="w-full max-w-4xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm p-3 rounded-lg mb-2">
                                    <strong>Note:</strong> Visual annotations are not available for this document. Issues are listed in the sidebar.
                                </div>
                            )}
                            <div className="relative w-full max-w-4xl bg-white shadow-2xl p-8 rounded-lg">
                                <div className="prose prose-slate max-w-none prose-sm">
                                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                                </div>
                                {/* HTML ANNOTATIONS (Floating) - Only if boxes exist */}
                                {issues.filter(i => i.boundingBox).length > 0 && (
                                    <div className="absolute inset-0 w-full h-full pointer-events-none z-50">
                                        <AnimatePresence>
                                            {issues.filter(i => i.boundingBox).map((issue) => {
                                                const box = issue.boundingBox;
                                                if (!box) return null;
                                                const globalIndex = issues.findIndex(x => x.id === issue.id);
                                                const centerX = box.x + (box.width / 2);
                                                const centerY = box.y + (box.height / 2);
                                                const isSelected = selectedIssueId === issue.id;
                                                return (
                                                    <motion.div
                                                        key={issue.id}
                                                        initial={{ opacity: 0, scale: 0 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0 }}
                                                        style={{ left: `${centerX}%`, top: `${centerY}%` }}
                                                        className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                                                        onClick={(e) => { e.stopPropagation(); onIssueSelect(issue.id); }}
                                                    >
                                                        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shadow-lg cursor-pointer pointer-events-auto transition-transform hover:scale-110 relative", isSelected ? "ring-2 ring-offset-1 ring-blue-500 scale-125" : "", issue.severity === 'High' ? "bg-red-500 text-white" : issue.severity === 'Medium' ? "bg-amber-500 text-white" : "bg-blue-500 text-white")}>
                                                            <span className="text-[10px] font-bold">{globalIndex + 1}</span>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Fallback for documents without visuals
                        <div className="flex items-center justify-center w-full h-full text-slate-500">
                            <p>Document preview not available</p>
                        </div>
                    )}
                </div>
            ) : (
                /* 2. ZOOMABLE MEDIA MODE (Image/Video) */
                <motion.div
                    className="relative inline-block"
                    style={{ scale, touchAction: "none" }}
                >
                    {/* MEDIA CONTENT */}
                    {isVideo ? (
                        <div className="relative group/video">
                            {/* Video Player */}
                            <video
                                ref={videoRef}
                                src={src}
                                className="max-w-full max-h-[80vh] shadow-2xl rounded-lg cursor-pointer object-contain bg-black"
                                onClick={() => {
                                    if (videoRef.current?.paused) videoRef.current.play();
                                    else videoRef.current?.pause();
                                }}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                                onEnded={() => setIsPlaying(false)}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
                                crossOrigin="anonymous"
                                playsInline
                            />
                            {/* Controls Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover/video:opacity-100 transition-opacity duration-300 flex flex-col gap-4 rounded-b-lg">
                                {/* (Condensed Controls Logic) */}
                                <div
                                    className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer hover:h-2.5 transition-all group/seekbar"
                                    onClick={(e) => {
                                        if (!videoRef.current || !duration) return;
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                                        videoRef.current.currentTime = percentage * duration;
                                    }}
                                >
                                    <div className="absolute top-0 left-0 h-full bg-purple-500 rounded-full pointer-events-none" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
                                    {/* Timeline Markers */}
                                    {issues.filter(i => i.timestamp !== undefined).map(issue => (
                                        <div key={issue.id}
                                            className={cn("absolute top-1/2 -translate-y-1/2 w-[2px] h-4 cursor-pointer transition-all z-20", issue.severity === 'High' ? "bg-red-500" : "bg-blue-500")}
                                            style={{ left: `${(issue.timestamp! / (duration || 1)) * 100}%` }}
                                            onClick={(e) => { e.stopPropagation(); handleSeekToIssue(issue); }}
                                            onMouseEnter={() => setHoveredMarkerId(issue.id)}
                                            onMouseLeave={() => setHoveredMarkerId(null)}
                                        >
                                            <AnimatePresence>
                                                {hoveredMarkerId === issue.id && (
                                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -25 }} exit={{ opacity: 0, y: 10 }} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900/90 backdrop-blur border border-white/10 rounded-md p-2 shadow-xl pointer-events-none">
                                                        <p className="text-[10px] text-white line-clamp-2">{issue.description}</p>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    {!isPlaying && <div className="bg-black/40 rounded-full p-4 backdrop-blur-sm"><Play className="w-8 h-8 text-white fill-white" /></div>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <img
                            src={src}
                            alt="Analyzed Asset"
                            className="w-full h-full object-contain max-h-[80vh] shadow-2xl rounded-lg block mx-auto"
                            draggable={false}
                        />
                    )}

                    {/* ANNOTATION OVERLAY (Zoomable) */}
                    <div className="absolute inset-0 w-full h-full pointer-events-none">
                        <AnimatePresence>
                            {issues.filter(i => i.boundingBox).map((issue) => {
                                const isSelected = selectedIssueId === issue.id;
                                // Robust condition: Show if not video OR if selected OR if within 3s window (even if at 0:00)
                                const isVideoMatch = isVideo && (isSelected || (issue.timestamp !== undefined && Math.abs(currentTime - issue.timestamp) < 3.0));

                                if (isVideo && !isVideoMatch) return null;

                                const box = issue.boundingBox;
                                if (!box) return null;

                                const globalIndex = issues.findIndex(x => x.id === issue.id);
                                const centerX = box.x + (box.width / 2);
                                const centerY = box.y + (box.height / 2);
                                const isRightSide = centerX > 50;

                                return (
                                    <motion.div
                                        key={issue.id}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0 }}
                                        style={{ left: `${centerX}%`, top: `${centerY}%` }}
                                        className="absolute z-30 flex items-center justify-center -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                                        onClick={(e) => { e.stopPropagation(); onIssueSelect(issue.id); }}
                                    >
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-all duration-300 relative group/dot", isSelected ? "scale-125 ring-2 ring-white z-50 text-white" : "scale-100 hover:scale-110 opacity-90 text-white", issue.severity === 'High' ? "bg-red-600" : issue.severity === 'Medium' ? "bg-amber-500" : "bg-indigo-600")}>
                                            <span className="text-xs font-black">{globalIndex + 1}</span>
                                            {(isSelected || issue.severity === 'High') && <div className={cn("absolute inset-0 rounded-full animate-ping opacity-40 will-change-transform", issue.severity === 'High' ? "bg-red-500" : issue.severity === 'Medium' ? "bg-amber-500" : "bg-indigo-500")} />}
                                        </div>
                                        {(isSelected || hoveredMarkerId === issue.id) && (
                                            <div className={cn("absolute top-1/2 -translate-y-1/2 w-64 z-50 pointer-events-none pl-4", isRightSide ? "right-full pr-4 pl-0" : "left-full")}>
                                                <motion.div initial={{ opacity: 0, x: isRightSide ? 10 : -10, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 text-left relative overflow-hidden">
                                                    <div className={cn("absolute top-0 bottom-0 left-0 w-1", issue.severity === 'High' ? "bg-red-500" : issue.severity === 'Medium' ? "bg-amber-500" : "bg-indigo-500")} />
                                                    <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                                                        <span className="text-[10px] font-black uppercase text-slate-400">#{globalIndex + 1}</span>
                                                        <span className="text-xs font-bold text-white uppercase truncate">{issue.category}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-200 font-medium leading-relaxed mb-3">{issue.description}</p>
                                                    <div className="bg-white/5 rounded p-2 flex gap-2 items-start"><Zap className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" /><div className="text-[10px] text-emerald-100/80 leading-tight font-mono">{issue.fix}</div></div>
                                                </motion.div>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )
            }
        </div >
    );
};
