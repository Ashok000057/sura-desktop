import React, { useState } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  Image,
  Archive,
  Music,
  Video,
  Play,
  RotateCcw,
  Eye,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';

interface SimulatedFile {
  id: string;
  name: string;
  extension: string;
  sizeBytes: number;
  isLocked?: boolean;
  isHidden?: boolean;
  category?: string;
  destFolder?: string;
  destName?: string;
  wasRenamed?: boolean;
  status: 'unorganized' | 'moved' | 'skipped' | 'locked';
  statusReason?: string;
}

const CATEGORY_MAP: Record<string, string[]> = {
  Images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
  Documents: ['.pdf', '.docx', '.doc', '.txt', '.md', '.xlsx', '.csv', '.epub'],
  Code: ['.py', '.js', '.ts', '.tsx', '.json', '.rs', '.go', '.html', '.css', '.sql'],
  Archives: ['.zip', '.tar.gz', '.rar', '.7z'],
  Audio: ['.mp3', '.wav', '.flac', '.m4a'],
  Video: ['.mp4', '.mov', '.mkv', '.webm'],
  Executables: ['.exe', '.dmg', '.pkg']
};

const INITIAL_DOWNLOADS_FILES: SimulatedFile[] = [
  { id: '1', name: 'financial_statement_2025.pdf', extension: '.pdf', sizeBytes: 1024 * 420, status: 'unorganized' },
  { id: '2', name: 'financial_statement_2025.pdf', extension: '.pdf', sizeBytes: 1024 * 420, status: 'unorganized' }, // duplicate!
  { id: '3', name: 'hero_product_banner.png', extension: '.png', sizeBytes: 1024 * 1250, status: 'unorganized' },
  { id: '4', name: 'main_controller.py', extension: '.py', sizeBytes: 1024 * 18, status: 'unorganized' },
  { id: '5', name: 'locked_system_cache.db', extension: '.db', sizeBytes: 1024 * 850, isLocked: true, status: 'unorganized' }, // permission error!
  { id: '6', name: 'backup_archive.zip', extension: '.zip', sizeBytes: 1024 * 34200, status: 'unorganized' },
  { id: '7', name: 'podcast_episode_42.mp3', extension: '.mp3', sizeBytes: 1024 * 14200, status: 'unorganized' },
  { id: '8', name: 'demo_screencast.mp4', extension: '.mp4', sizeBytes: 1024 * 54300, status: 'unorganized' },
  { id: '9', name: '.env.local', extension: '.local', sizeBytes: 512, isHidden: true, status: 'unorganized' }, // hidden dotfile!
  { id: '10', name: 'package.json', extension: '.json', sizeBytes: 1024 * 3, status: 'unorganized' },
  { id: '11', name: 'meeting_notes.docx', extension: '.docx', sizeBytes: 1024 * 45, status: 'unorganized' },
  { id: '12', name: 'unrecognized_firmware.bin', extension: '.bin', sizeBytes: 1024 * 920, status: 'unorganized' }
];

export const OrganizerSandbox: React.FC = () => {
  const [currentFolder, setCurrentFolder] = useState<string>('~/Downloads');
  const [files, setFiles] = useState<SimulatedFile[]>(INITIAL_DOWNLOADS_FILES);
  const [history, setHistory] = useState<SimulatedFile[][]>([]);
  const [dryRunPreview, setDryRunPreview] = useState<SimulatedFile[] | null>(null);
  const [lastRunReport, setLastRunReport] = useState<{
    scanned: number;
    moved: number;
    skipped: number;
    categories: string[];
    isDryRun: boolean;
  } | null>(null);

  // Settings
  const [autoDisambiguate, setAutoDisambiguate] = useState<boolean>(true);
  const [skipHidden, setSkipHidden] = useState<boolean>(true);
  const [categorizeUnknown, setCategorizeUnknown] = useState<boolean>(false);

  // Add custom file modal / inline state
  const [newFileName, setNewFileName] = useState('');
  const [newFileLocked, setNewFileLocked] = useState(false);

  const getCategoryForExt = (ext: string): string | null => {
    const cleanExt = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
    for (const [cat, exts] of Object.entries(CATEGORY_MAP)) {
      if (exts.includes(cleanExt)) return cat;
    }
    return null;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'Images':
        return <Image className="w-4 h-4 text-emerald-400" />;
      case 'Documents':
        return <FileText className="w-4 h-4 text-sky-400" />;
      case 'Code':
        return <FileCode className="w-4 h-4 text-violet-400" />;
      case 'Archives':
        return <Archive className="w-4 h-4 text-amber-400" />;
      case 'Audio':
        return <Music className="w-4 h-4 text-pink-400" />;
      case 'Video':
        return <Video className="w-4 h-4 text-rose-400" />;
      default:
        return <Folder className="w-4 h-4 text-slate-400" />;
    }
  };

  // Run dry run or real organization
  const processOrganization = (isDryRun: boolean) => {
    const plannedFiles: SimulatedFile[] = [];
    const usedNamesPerCategory: Record<string, Set<string>> = {};
    const createdCategories = new Set<string>();

    let movedCount = 0;
    let skippedCount = 0;

    files.forEach((file) => {
      // Edge Case 1: Hidden dotfiles
      if (skipHidden && (file.isHidden || file.name.startsWith('.'))) {
        plannedFiles.push({
          ...file,
          status: 'skipped',
          statusReason: 'Skipped: Hidden system file (.dotfile)'
        });
        skippedCount++;
        return;
      }

      // Edge Case 2: Permission denied / File lock
      if (file.isLocked) {
        plannedFiles.push({
          ...file,
          status: 'locked',
          statusReason: 'Permission Denied: File in use by another process'
        });
        skippedCount++;
        return;
      }

      // Determine category
      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
      let cat = getCategoryForExt(ext);

      if (!cat) {
        if (categorizeUnknown) {
          cat = 'Miscellaneous';
        } else {
          plannedFiles.push({
            ...file,
            status: 'skipped',
            statusReason: 'Skipped: Unrecognized extension (retained in root)'
          });
          skippedCount++;
          return;
        }
      }

      createdCategories.add(cat);
      if (!usedNamesPerCategory[cat]) {
        usedNamesPerCategory[cat] = new Set();
      }

      // Edge Case 3: Duplicate disambiguation
      let targetName = file.name;
      let wasRenamed = false;

      if (usedNamesPerCategory[cat].has(targetName)) {
        if (autoDisambiguate) {
          const parts = targetName.split('.');
          const stem = parts.slice(0, -1).join('.') || targetName;
          const extension = parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
          let counter = 1;
          while (usedNamesPerCategory[cat].has(`${stem} (${counter})${extension}`)) {
            counter++;
          }
          targetName = `${stem} (${counter})${extension}`;
          wasRenamed = true;
        } else {
          plannedFiles.push({
            ...file,
            status: 'skipped',
            statusReason: 'Skipped: Destination file collision'
          });
          skippedCount++;
          return;
        }
      }

      usedNamesPerCategory[cat].add(targetName);
      movedCount++;

      plannedFiles.push({
        ...file,
        destFolder: cat,
        destName: targetName,
        wasRenamed,
        category: cat,
        status: 'moved',
        statusReason: wasRenamed
          ? `Disambiguated to ${targetName} to prevent collision`
          : `Sorted into ${cat}/`
      });
    });

    if (isDryRun) {
      setDryRunPreview(plannedFiles);
      setLastRunReport({
        scanned: files.length,
        moved: movedCount,
        skipped: skippedCount,
        categories: Array.from(createdCategories),
        isDryRun: true
      });
    } else {
      setHistory((prev) => [...prev, files]);
      setFiles(plannedFiles);
      setDryRunPreview(null);
      setLastRunReport({
        scanned: files.length,
        moved: movedCount,
        skipped: skippedCount,
        categories: Array.from(createdCategories),
        isDryRun: false
      });
    }
  };

  const handleRevert = () => {
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    setFiles(previousState);
    setHistory((prev) => prev.slice(0, -1));
    setDryRunPreview(null);
    setLastRunReport(null);
  };

  const handleResetToDefault = () => {
    setFiles(INITIAL_DOWNLOADS_FILES);
    setHistory([]);
    setDryRunPreview(null);
    setLastRunReport(null);
  };

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const ext = newFileName.includes('.') ? `.${newFileName.split('.').pop()}` : '';
    const newFile: SimulatedFile = {
      id: Date.now().toString(),
      name: newFileName.trim(),
      extension: ext,
      sizeBytes: Math.floor(Math.random() * 500000) + 1024,
      isLocked: newFileLocked,
      isHidden: newFileName.startsWith('.'),
      status: 'unorganized'
    };
    setFiles((prev) => [...prev, newFile]);
    setNewFileName('');
    setNewFileLocked(false);
    setDryRunPreview(null);
  };

  const activeDisplayFiles = dryRunPreview || files;
  const isOrganized = files.some((f) => f.status === 'moved');

  // Group files by folder for organized state
  const folderBuckets: Record<string, SimulatedFile[]> = {};
  if (isOrganized && !dryRunPreview) {
    activeDisplayFiles.forEach((file) => {
      const folderKey = file.status === 'moved' && file.destFolder ? file.destFolder : 'Root Directory (Unsorted)';
      if (!folderBuckets[folderKey]) folderBuckets[folderKey] = [];
      folderBuckets[folderKey].push(file);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header & Path Banner */}
      <div className="bg-[#101726] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
              <span>Python Backend Module</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-300">file_organizer.py</span>
              <span aria-hidden="true">·</span>
              <span>Self-Healing Engine</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Intelligent File Organization Sandbox
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Simulates real-world directory scanning, extension categorization, duplicate file collisions (<code className="text-slate-300">name (1).ext</code>), permission locks, and rollback manifests.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => processOrganization(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Dry Run Preview</span>
            </button>

            <button
              onClick={() => processOrganization(false)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Sort & Organize</span>
            </button>

            {history.length > 0 && (
              <button
                onClick={handleRevert}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/60 rounded-lg transition-colors whitespace-nowrap"
                title="Rollback organization using .devpulse_organize_history.json manifest"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert Last Run</span>
              </button>
            )}

            <button
              onClick={handleResetToDefault}
              className="px-2.5 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Reset sandbox to original state"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Directory Breadcrumb Bar & Options */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-mono text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-slate-500">Path:</span>
            <input
              type="text"
              value={currentFolder}
              onChange={(e) => setCurrentFolder(e.target.value)}
              className="bg-transparent focus:outline-none text-blue-300 w-44 sm:w-60"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={autoDisambiguate}
                onChange={(e) => setAutoDisambiguate(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
              />
              <span>Disambiguate duplicates</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={skipHidden}
                onChange={(e) => setSkipHidden(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
              />
              <span>Skip hidden dotfiles</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300 select-none">
              <input
                type="checkbox"
                checked={categorizeUnknown}
                onChange={(e) => setCategorizeUnknown(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
              />
              <span>Group unmapped in "Miscellaneous"</span>
            </label>
          </div>
        </div>
      </div>

      {/* Execution Metrics Banner if run */}
      {lastRunReport && (
        <div
          className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
            lastRunReport.isDryRun
              ? 'bg-sky-950/20 border-sky-800/60 text-sky-200'
              : 'bg-emerald-950/20 border-emerald-800/60 text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {lastRunReport.isDryRun ? (
              <Eye className="w-5 h-5 text-sky-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <div>
              <div className="font-semibold text-sm">
                {lastRunReport.isDryRun ? 'Dry Run Simulation Complete' : 'Files Successfully Organized'}
              </div>
              <div className="text-slate-400 mt-0.5">
                Target: <span className="font-mono text-slate-300">{currentFolder}</span> · Categories:{' '}
                <span className="text-slate-200">{lastRunReport.categories.join(', ') || 'None'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 font-mono tabular-nums">
            <div>
              <span className="text-slate-400">Scanned: </span>
              <span className="font-bold text-white">{lastRunReport.scanned}</span>
            </div>
            <div>
              <span className="text-slate-400">Moved: </span>
              <span className="font-bold text-emerald-400">{lastRunReport.moved}</span>
            </div>
            <div>
              <span className="text-slate-400">Skipped: </span>
              <span className="font-bold text-amber-400">{lastRunReport.skipped}</span>
            </div>
          </div>
        </div>
      )}

      {/* Folder Visualizer or File Grid */}
      {isOrganized && !dryRunPreview ? (
        /* Categorized Folder Views */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-medium text-slate-300">
              Sorted Directory Tree ({Object.keys(folderBuckets).length} Folders)
            </span>
            <span>Recorded in .devpulse_organize_history.json</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(folderBuckets).map(([folderName, folderFiles]) => (
              <div
                key={folderName}
                className="bg-[#111927] border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(folderName)}
                      <span className="text-sm font-semibold text-slate-200">{folderName}</span>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      {folderFiles.length} file{folderFiles.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {folderFiles.map((f) => (
                      <li
                        key={f.id}
                        className="text-xs flex items-center justify-between gap-2 p-1.5 rounded bg-slate-900/60 border border-slate-800/50"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate text-slate-300" title={f.destName || f.name}>
                            {f.destName || f.name}
                          </span>
                          {f.wasRenamed && (
                            <span
                              className="text-[10px] text-amber-400 bg-amber-950/60 px-1 rounded shrink-0"
                              title={`Renamed to avoid duplicate collision with existing ${f.name}`}
                            >
                              auto-renamed
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                          {formatSize(f.sizeBytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 pt-2 text-[11px] text-slate-500 font-mono flex items-center justify-between border-t border-slate-800/50">
                  <span>Target: {folderName}/</span>
                  <span className="tabular-nums">
                    {formatSize(folderFiles.reduce((acc, curr) => acc + curr.sizeBytes, 0))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Flat Unorganized or Dry Run Table */
        <div className="bg-[#101726] border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">
                {dryRunPreview ? 'Simulated Move Manifest (Dry Run)' : 'Files in Target Directory'}
              </span>
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                ({activeDisplayFiles.length} items)
              </span>
            </div>

            <span className="text-xs text-slate-400">
              {dryRunPreview ? 'Changes not yet committed to disk' : 'Ready for sorting'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b101c] text-slate-400 uppercase font-mono text-[11px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">File Name</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Target Destination</th>
                  <th className="py-2.5 px-4 text-right">Engine Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-sans">
                {activeDisplayFiles.map((file) => {
                  const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
                  const resolvedCategory = file.category || getCategoryForExt(ext) || 'Miscellaneous';

                  return (
                    <tr
                      key={file.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        file.status === 'locked'
                          ? 'bg-rose-950/10'
                          : file.wasRenamed
                          ? 'bg-amber-950/10'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-200 flex items-center gap-2">
                        {file.isLocked ? (
                          <span title="File locked by process">
                            <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          </span>
                        ) : (
                          getCategoryIcon(resolvedCategory)
                        )}
                        <span className="truncate max-w-xs">{file.name}</span>
                        {file.isHidden && (
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded font-mono">
                            hidden
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-400">
                        {formatSize(file.sizeBytes)}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="text-slate-300 font-medium">
                          {file.isLocked ? '—' : resolvedCategory}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {file.isLocked ? (
                          <span className="text-rose-400">Unchanged (Locked)</span>
                        ) : file.status === 'skipped' ? (
                          <span className="text-slate-500">Unchanged</span>
                        ) : (
                          <span className="text-sky-300">
                            {resolvedCategory}/{file.destName || file.name}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        {file.isLocked ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            Permission Error Handled
                          </span>
                        ) : file.wasRenamed ? (
                          <span className="inline-flex items-center gap-1 text-amber-300 text-[11px]">
                            <Sparkles className="w-3 h-3" />
                            Collision Resolved ({file.destName})
                          </span>
                        ) : file.status === 'skipped' ? (
                          <span className="text-slate-500 text-[11px]">Skipped</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                            <CheckCircle2 className="w-3 h-3" />
                            Ready to Move
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Custom Test File Form */}
      <div className="bg-[#101726] border border-slate-800 rounded-xl p-4">
        <form onSubmit={handleAddFile} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="text-xs font-semibold text-slate-300 shrink-0 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>Inject Test File:</span>
          </div>

          <div className="flex-1 w-full flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g., quarterly_report.pdf, audio_sample.wav, script.py"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full"
            />
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newFileLocked}
                onChange={(e) => setNewFileLocked(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-0"
              />
              <span>Simulate Permission Lock</span>
            </label>

            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Add to Sandbox
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
