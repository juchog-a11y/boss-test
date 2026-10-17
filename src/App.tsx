import React, { useState, useEffect, useRef } from 'react';
import {
  Github,
  Download,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Terminal,
  ShieldCheck,
  AlertCircle,
  Play,
  Key,
  UploadCloud,
  CheckCircle2,
  Loader2,
  X,
  Volume2,
  VolumeX
} from 'lucide-react';

export default function App() {
  const [showExportModal, setShowExportModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // GitHub user & repo settings
  const [githubUsername, setGithubUsername] = useState('juchog');
  const [repoName, setRepoName] = useState('boss');
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('gh_pat_token') || '');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{
    type: 'idle' | 'loading' | 'success' | 'error';
    message: string;
    repoUrl?: string;
  }>({ type: 'idle', message: '' });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMusicOn, setIsMusicOn] = useState(() => {
    try {
      const saved = localStorage.getItem('game_music_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleMusicFromTopBar = () => {
    try {
      const iframeWin = iframeRef.current?.contentWindow as any;
      if (iframeWin && iframeWin.Sound) {
        const nextState = iframeWin.Sound.toggleMusic();
        setIsMusicOn(nextState);
        return;
      }
    } catch (e) {}
    setIsMusicOn((prev) => !prev);
  };

  useEffect(() => {
    // Automatically focus the game iframe so controls work immediately
    const timer = setTimeout(() => {
      iframeRef.current?.focus();
    }, 200);
    return () => clearTimeout(timer);
  }, [showExportModal]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleDownloadHtml = () => {
    const link = document.createElement('a');
    link.href = '/boss.html';
    link.download = 'boss.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Direct push via GitHub REST API if user provides PAT
  const handleDirectGitHubPush = async () => {
    if (!githubToken.trim()) {
      setPublishStatus({
        type: 'error',
        message: 'Пожалуйста, введите Personal Access Token (PAT) от GitHub с правами "repo".'
      });
      return;
    }

    setIsPublishing(true);
    setPublishStatus({ type: 'loading', message: 'Проверка токена и создание репозитория boss...' });
    localStorage.setItem('gh_pat_token', githubToken.trim());

    try {
      // 1. Check user info
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${githubToken.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (!userRes.ok) {
        throw new Error('Не удалось авторизоваться в GitHub. Проверьте токен.');
      }
      const userData = await userRes.json();
      const owner = userData.login;
      setGithubUsername(owner);

      // 2. Create repo 'boss' if it doesn't exist
      setPublishStatus({ type: 'loading', message: `Проверка репозитория ${owner}/${repoName}...` });
      const checkRepoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
        headers: {
          Authorization: `token ${githubToken.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });

      if (checkRepoRes.status === 404) {
        setPublishStatus({ type: 'loading', message: `Создание нового репозитория ${repoName}...` });
        const createRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            Authorization: `token ${githubToken.trim()}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: repoName,
            description: 'Лабиринт и Зомби: Пиксельный Охотник (Boss game)',
            private: false,
            auto_init: true
          })
        });

        if (!createRes.ok) {
          const errData = await createRes.json();
          throw new Error(errData.message || 'Ошибка создания репозитория');
        }
        // Small delay for GitHub to initialize branch
        await new Promise((r) => setTimeout(r, 1500));
      }

      // 3. Fetch html content to upload
      setPublishStatus({ type: 'loading', message: 'Загрузка игровых файлов в репозиторий...' });
      const htmlRes = await fetch('/boss.html');
      const htmlText = await htmlRes.text();
      const base64Content = btoa(unescape(encodeURIComponent(htmlText)));

      // Check if file already exists to get its sha
      let sha: string | undefined;
      const getFileRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/index.html`, {
        headers: {
          Authorization: `token ${githubToken.trim()}`,
          Accept: 'application/vnd.github.v3+json'
        }
      });
      if (getFileRes.ok) {
        const fileData = await getFileRes.json();
        sha = fileData.sha;
      }

      // 4. Commit index.html
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/index.html`, {
        method: 'PUT',
        headers: {
          Authorization: `token ${githubToken.trim()}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Add game Лабиринт и Зомби (Boss project)',
          content: base64Content,
          sha: sha
        })
      });

      if (!commitRes.ok) {
        const errData = await commitRes.json();
        throw new Error(errData.message || 'Не удалось загрузить файл в репозиторий');
      }

      const repoUrl = `https://github.com/${owner}/${repoName}`;
      setPublishStatus({
        type: 'success',
        message: `Игра успешно выгружена на GitHub в проект «${repoName}»!`,
        repoUrl
      });
    } catch (err: any) {
      setPublishStatus({
        type: 'error',
        message: err.message || 'Произошла ошибка при выгрузке.'
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const gitCommands = `# 1. Перейдите в папку с проектом
git init
git add .
git commit -m "Initial commit: Boss Game (Лабиринт и Зомби)"
git branch -M main
git remote add origin https://github.com/${githubUsername.trim() || 'your-username'}/${repoName.trim() || 'boss'}.git
git push -u origin main`;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Floating Action Bar */}
      <div className="absolute top-2 left-2 right-2 z-30 pointer-events-none flex items-center justify-between gap-3">
        {/* Game Title Badge */}
        <div className="pointer-events-auto flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3.5 py-2 rounded-xl shadow-xl shadow-black/50">
          <span className="text-lg">⚔️</span>
          <div>
            <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>Лабиринт и Зомби: Пиксельный Охотник</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Boss
              </span>
            </div>
            <div className="text-[10px] text-slate-400 hidden sm:block">
              5 зон: Деревня • Кладбище • Лес • Храм • Подземелье с Боссом
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Main GitHub Export Button */}
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">Выгрузить на GitHub в проект</span>
            <span className="font-mono bg-indigo-900/60 px-1.5 py-0.5 rounded border border-indigo-400/40 text-amber-300">
              boss
            </span>
          </button>

          {/* Download Standalone HTML */}
          <button
            onClick={handleDownloadHtml}
            title="Скачать файл boss.html"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700 shadow-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Скачать HTML</span>
          </button>

          {/* Music Toggle */}
          <button
            onClick={toggleMusicFromTopBar}
            title={isMusicOn ? "Выключить музыку [M]" : "Включить музыку [M]"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-medium border border-slate-700 shadow-lg transition-colors cursor-pointer"
          >
            {isMusicOn ? (
              <>
                <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="hidden lg:inline text-amber-300 font-medium">Музыка</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-500" />
                <span className="hidden lg:inline text-slate-500">Музыка</span>
              </>
            )}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            title="Во весь экран"
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 shadow-lg transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Embedded Game Iframe */}
      <iframe
        ref={iframeRef}
        src="/boss.html"
        title="Лабиринт и Зомби: Пиксельный Охотник"
        className="w-full h-full border-none m-0 p-0 block"
        allow="autoplay; fullscreen"
      />

      {/* GitHub Export Modal Dialog */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3.5 mb-5">
              <div className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Github className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Выгрузка игры в проект GitHub
                  <span className="font-mono text-amber-300 text-sm px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                    boss
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Выберите удобный способ: через встроенную кнопку AI Studio, авто-загрузку по API или консольный Git.
                </p>
              </div>
            </div>

            {/* Method 1: AI Studio Built-in Export (Easiest) */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-slate-900 border border-indigo-500/40 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                  <span className="text-sm font-semibold text-white">В 1 клик через интерфейс AI Studio</span>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Рекомендуемый способ
                </span>
              </div>
              <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside pl-1">
                <li>В верхней правой панели экрана AI Studio найдите кнопку <strong className="text-indigo-300">«Export»</strong> (или иконку <strong className="text-indigo-300">GitHub</strong>).</li>
                <li>В появившемся окне введите имя репозитория: <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300 font-bold border border-slate-700">boss</code></li>
                <li>Нажмите <strong className="text-emerald-400">«Push» / «Create Repository»</strong> — проект будет создан и загружен на ваш аккаунт!</li>
              </ol>
            </div>

            {/* Method 2: Direct API Push with Token */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold">2</span>
                  <span className="text-sm font-semibold text-white">Автоматическая отправка по GitHub API</span>
                </div>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=AI_Studio_Boss_Game"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  Создать токен на GitHub <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Введите Personal Access Token (PAT) с правом <code className="text-indigo-300">repo</code>, и мы сами создадим репозиторий <code className="text-amber-300 font-bold">boss</code> и загрузим в него игру прямо сейчас:
              </p>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={handleDirectGitHubPush}
                  disabled={isPublishing || !githubToken.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Выгрузка...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Создать и выгрузить</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status Display */}
              {publishStatus.type !== 'idle' && (
                <div
                  className={`mt-3 p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                    publishStatus.type === 'loading'
                      ? 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-200'
                      : publishStatus.type === 'success'
                      ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-200'
                      : 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
                  }`}
                >
                  {publishStatus.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5 text-indigo-400" />}
                  {publishStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />}
                  {publishStatus.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />}
                  <div className="flex-1">
                    <div>{publishStatus.message}</div>
                    {publishStatus.repoUrl && (
                      <a
                        href={publishStatus.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-1 font-bold text-emerald-300 underline"
                      >
                        Открыть созданный репозиторий: {publishStatus.repoUrl} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Method 3: Git Terminal Commands */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold">3</span>
                  <span className="text-sm font-semibold text-white">Выгрузка через терминал (Git CLI)</span>
                </div>
                <button
                  onClick={() => copyToClipboard(gitCommands, 'cli-boss')}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {copiedKey === 'cli-boss' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'cli-boss' ? 'Скопировано!' : 'Скопировать команды'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Ваш логин на GitHub:</label>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Имя репозитория:</label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-amber-300 font-mono font-bold"
                  />
                </div>
              </div>

              <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed border border-slate-800">
                {gitCommands}
              </pre>
            </div>

            {/* Footer Buttons */}
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Вернуться к игре
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
