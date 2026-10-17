import React, { useState, useEffect } from 'react';
import {
  Github,
  GitBranch,
  FolderGit2,
  Key,
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  Terminal,
  Download,
  RefreshCw,
  Star,
  GitFork,
  Search,
  ShieldCheck,
  AlertCircle,
  Code2,
  Layers,
  Lock,
  User,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';

interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  html_url: string;
  company?: string;
  location?: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  default_branch: string;
  visibility?: string;
  private?: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'export' | 'explorer' | 'oauth' | 'guide'>('export');
  
  // Custom repo config for git command generator
  const [userRepoUrl, setUserRepoUrl] = useState('https://github.com/username/my-project.git');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // GitHub Explorer state
  const [searchTarget, setSearchTarget] = useState('facebook');
  const [personalToken, setPersonalToken] = useState(() => {
    return localStorage.getItem('gh_test_token') || '';
  });
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [userData, setUserData] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<{ limit: number; remaining: number } | null>(null);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const fetchGitHubData = async (targetUser: string, tokenToUse?: string) => {
    const trimmed = targetUser.trim();
    if (!trimmed && !tokenToUse) return;

    setIsLoading(true);
    setExplorerError(null);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (tokenToUse) {
      headers.Authorization = `token ${tokenToUse}`;
    }

    try {
      // If token provided without specific username, fetch authenticated user (/user)
      const userEndpoint = (!trimmed && tokenToUse)
        ? 'https://api.github.com/user'
        : `https://api.github.com/users/${encodeURIComponent(trimmed)}`;

      const userRes = await fetch(userEndpoint, { headers });

      // Track rate limits
      const limit = userRes.headers.get('x-ratelimit-limit');
      const remaining = userRes.headers.get('x-ratelimit-remaining');
      if (limit && remaining) {
        setRateLimit({ limit: parseInt(limit, 10), remaining: parseInt(remaining, 10) });
      }

      if (!userRes.ok) {
        if (userRes.status === 404) {
          throw new Error(`Пользователь или организация «${trimmed}» не найдены на GitHub.`);
        } else if (userRes.status === 401) {
          throw new Error('Токен авторизации недействителен или отозван.');
        } else if (userRes.status === 403) {
          throw new Error('Исчерпан лимит запросов GitHub API (Rate Limit exceeded). Введите Personal Access Token для 5000 запросов/час.');
        } else {
          throw new Error(`Ошибка GitHub API (${userRes.status}): ${userRes.statusText}`);
        }
      }

      const userJson: GitHubUser = await userRes.json();
      setUserData(userJson);

      // Fetch repos
      const reposEndpoint = (!trimmed && tokenToUse)
        ? 'https://api.github.com/user/repos?sort=updated&per_page=12'
        : `https://api.github.com/users/${encodeURIComponent(userJson.login)}/repos?sort=updated&per_page=12`;

      const reposRes = await fetch(reposEndpoint, { headers });
      if (reposRes.ok) {
        const reposJson: GitHubRepo[] = await reposRes.json();
        setRepos(reposJson);
      }
    } catch (err: any) {
      setExplorerError(err.message || 'Не удалось загрузить данные из GitHub.');
      setUserData(null);
      setRepos([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch of sample data
    fetchGitHubData('torvalds');
  }, []);

  const handleSaveToken = (val: string) => {
    setPersonalToken(val);
    if (val.trim()) {
      localStorage.setItem('gh_test_token', val.trim());
    } else {
      localStorage.removeItem('gh_test_token');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Banner */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
              <Github className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                GitHub Connect & Guide
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  AI Studio
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                Все способы подключения GitHub: экспорт кода, Git CLI, OAuth и GitHub REST API
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://github.com/new"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>Создать репо на GitHub</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-4 border-t border-slate-800/60 overflow-x-auto scrollbar-none py-1">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'export'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FolderGit2 className="w-4 h-4" />
            1. Экспорт проекта в GitHub (Код)
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'explorer'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Search className="w-4 h-4" />
            2. Интерактивный GitHub Explorer & API
          </button>

          <button
            onClick={() => setActiveTab('oauth')}
            className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'oauth'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Key className="w-4 h-4" />
            3. Настройка GitHub OAuth
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'guide'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            4. Справка и частые вопросы
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* TAB 1: EXPORT PROJECT TO GITHUB */}
        {activeTab === 'export' && (
          <div className="space-y-6">
            {/* Direct Answer Alert */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Как связать этот проект с вашим GitHub репозиторием
                  </h2>
                  <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                    Есть <strong>два основных сценария</strong>, когда спрашивают «как подключить GitHub»:
                  </p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
                      <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
                        <FolderGit2 className="w-4 h-4" />
                        Сценарий А: Выгрузить код в GitHub
                      </div>
                      <p className="text-slate-400 mt-1">
                        Сохранить файлы этого приложения в ваш личный репозиторий GitHub для версионирования, командной разработки или деплоя (Vercel, Render, Cloudflare).
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
                      <div className="font-semibold text-teal-300 flex items-center gap-1.5">
                        <Key className="w-4 h-4" />
                        Сценарий Б: Интегрировать GitHub в приложение
                      </div>
                      <p className="text-slate-400 mt-1">
                        Дать приложению читать репозитории пользователя, авторизовывать пользователей («Войти через GitHub»), создавать коммиты или issue через GitHub REST API / OAuth.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-Step for Export */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Methods */}
              <div className="lg:col-span-7 space-y-4">
                {/* Method 1: In-UI AI Studio Export */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">1</span>
                      <h3 className="font-semibold text-white text-base">Кнопка «Export / GitHub» в AI Studio</h3>
                    </div>
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium">
                      Самый простой
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    В правом верхнем углу интерфейса Google AI Studio Build найдите меню экспорта:
                  </p>
                  <ol className="mt-3 space-y-2 text-sm text-slate-400 list-decimal list-inside pl-1">
                    <li>Нажмите на кнопку с иконкой <strong className="text-slate-200">GitHub</strong> или кнопку меню с тремя точками в верхней панели AI Studio.</li>
                    <li>Выберите <strong className="text-slate-200">«Export to GitHub»</strong> или <strong className="text-slate-200">«Connect GitHub»</strong>.</li>
                    <li>Авторизуйте приложение Google AI Studio в вашем аккаунте GitHub.</li>
                    <li>Выберите имя нового репозитория (например, <code className="text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">my-ai-studio-app</code>) и нажмите <strong className="text-slate-200">Create & Push</strong>.</li>
                  </ol>
                </div>

                {/* Method 2: Git CLI commands generator */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">2</span>
                      <h3 className="font-semibold text-white text-base">Выгрузка через Git CLI (Терминал)</h3>
                    </div>
                    <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-medium">
                      Полный контроль
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Если вы скачали ZIP-архив проекта или клонировали его локально:
                  </p>

                  {/* Config Inputs */}
                  <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        URL вашего репозитория на GitHub:
                      </label>
                      <input
                        type="text"
                        value={userRepoUrl}
                        onChange={(e) => setUserRepoUrl(e.target.value)}
                        placeholder="https://github.com/your-username/your-repo.git"
                        className="w-full text-xs font-mono bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Основная ветка:
                        </label>
                        <select
                          value={defaultBranch}
                          onChange={(e) => setDefaultBranch(e.target.value)}
                          className="w-full text-xs bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="main">main (стандартная)</option>
                          <option value="master">master</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Generated Shell Command */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span className="flex items-center gap-1">
                        <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                        Выполните в терминале в папке проекта:
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `git init\ngit add .\ngit commit -m "Initial commit from AI Studio"\ngit branch -M ${defaultBranch}\ngit remote add origin ${userRepoUrl}\ngit push -u origin ${defaultBranch}`,
                            'git-cli'
                          )
                        }
                        className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors text-xs"
                      >
                        {copiedKey === 'git-cli' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === 'git-cli' ? 'Скопировано!' : 'Скопировать всё'}
                      </button>
                    </div>
                    <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed">
{`# 1. Инициализируем локальный git репозиторий
git init

# 2. Добавляем все файлы
git add .

# 3. Делаем первый коммит
git commit -m "Initial commit from AI Studio"

# 4. Переименовываем ветку в ${defaultBranch}
git branch -M ${defaultBranch}

# 5. Привязываем удаленный GitHub репозиторий
git remote add origin ${userRepoUrl}

# 6. Отправляем код в GitHub
git push -u origin ${defaultBranch}`}
                    </pre>
                  </div>
                </div>

                {/* Method 3: GitHub CLI (gh) */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">3</span>
                      <h3 className="font-semibold text-white text-base">Через утилиту GitHub CLI (gh)</h3>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Если у вас установлена утилита <code className="text-slate-200">gh</code>, можно создать удаленный репозиторий прямо из консоли:
                  </p>
                  <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-indigo-300 overflow-x-auto">
{`# Создать репозиторий на GitHub и сразу запушить текущую папку:
gh repo create my-app --public --source=. --remote=origin --push`}
                  </pre>
                </div>
              </div>

              {/* Right Column: Pre-configured Files Checklist */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
                  <h3 className="font-semibold text-white text-base flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Готовность проекта к GitHub
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Проект уже содержит корректную конфигурацию для чистого репозитория:
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-mono font-semibold text-slate-200">.gitignore</span>
                        <p className="text-slate-400 mt-0.5">
                          Исключает <code className="text-indigo-300">node_modules/</code>, <code className="text-indigo-300">dist/</code> и локальные файлы окружения.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-mono font-semibold text-slate-200">.env.example</span>
                        <p className="text-slate-400 mt-0.5">
                          Шаблон переменных без секретных ключей. Никогда не коммитьте реальный API-ключ в открытый GitHub!
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="font-mono font-semibold text-slate-200">package.json & tsconfig</span>
                        <p className="text-slate-400 mt-0.5">
                          Готовы скрипты сборки <code className="text-indigo-300">npm run build</code> и запуск Vite.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold block mb-0.5">Важно про безопасность:</strong>
                      Ваш API-ключ Gemini (или любые токены) автоматически защищены и хранятся на стороне сервера в AI Studio. Не вставляйте открытые ключи прямо в исходный код при пуше на GitHub.
                    </div>
                  </div>
                </div>

                {/* Quick actions box */}
                <div className="bg-gradient-to-br from-indigo-900/30 to-slate-900 rounded-xl border border-indigo-500/20 p-5">
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-indigo-400" />
                    Хотите автоматизировать деплой?
                  </h4>
                  <p className="text-xs text-slate-300 mb-4">
                    После отправки репозитория на GitHub вы можете развернуть этот проект бесплатно в 1 клик на Vercel, Netlify или Cloudflare Pages.
                  </p>
                  <button
                    onClick={() => setActiveTab('guide')}
                    className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Посмотреть инструкцию по деплою
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GITHUB EXPLORER & API */}
        {activeTab === 'explorer' && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FolderGit2 className="w-5 h-5 text-indigo-400" />
                    GitHub API Explorer в действии
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Проверьте подключение к GitHub прямо сейчас. Найдите любой профиль или используйте свой Personal Access Token для авторизованного доступа.
                  </p>
                </div>

                {rateLimit && (
                  <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center gap-2 self-start sm:self-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Лимит запросов API: <strong className="text-slate-200">{rateLimit.remaining}</strong> / {rateLimit.limit}</span>
                  </div>
                )}
              </div>

              {/* Search Bar & Token Toggle */}
              <div className="mt-5 flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={searchTarget}
                    onChange={(e) => setSearchTarget(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchGitHubData(searchTarget, personalToken)}
                    placeholder="Логин пользователя GitHub (например: torvalds, vercel, google, ваш логин)..."
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  onClick={() => fetchGitHubData(searchTarget, personalToken)}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-indigo-600/20"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Загрузка...' : 'Найти в GitHub'}</span>
                </button>

                <button
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  className={`px-3.5 py-2.5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    showTokenInput || personalToken
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>{personalToken ? 'Токен подключен' : 'Добавить токен (PAT)'}</span>
                </button>
              </div>

              {/* Optional Token Box */}
              {showTokenInput && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-indigo-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-400" />
                      GitHub Personal Access Token (classic или fine-grained)
                    </label>
                    <a
                      href="https://github.com/settings/tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      Создать токен на github.com <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-slate-400">
                    Токен позволяет делать до 5000 запросов в час, а также просматривать ваши приватные репозитории. Он сохраняется только локально в вашем браузере (localStorage).
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={personalToken}
                      onChange={(e) => handleSaveToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                    {personalToken && (
                      <button
                        onClick={() => handleSaveToken('')}
                        className="px-3 py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md hover:bg-rose-500/20"
                      >
                        Очистить
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Error Display */}
            {explorerError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-0.5">Ошибка при обращении к GitHub:</strong>
                  {explorerError}
                </div>
              </div>
            )}

            {/* Result Area */}
            {userData && (
              <div className="space-y-6">
                {/* Profile Card */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <img
                    src={userData.avatar_url}
                    alt={userData.login}
                    className="w-20 h-20 rounded-2xl border-2 border-slate-700 shadow-md object-cover"
                  />
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                          {userData.name || userData.login}
                          <a
                            href={userData.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-indigo-400"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </h3>
                        <p className="text-sm font-mono text-indigo-400">@{userData.login}</p>
                      </div>
                      <a
                        href={userData.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                      >
                        Открыть профиль на GitHub
                      </a>
                    </div>

                    {userData.bio && (
                      <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">
                        {userData.bio}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
                      <div>
                        <strong className="text-slate-200">{userData.public_repos}</strong> репозиториев
                      </div>
                      <div>•</div>
                      <div>
                        <strong className="text-slate-200">{userData.followers}</strong> подписчиков
                      </div>
                      <div>•</div>
                      <div>
                        <strong className="text-slate-200">{userData.following}</strong> подписок
                      </div>
                      {userData.location && (
                        <>
                          <div>•</div>
                          <div>📍 {userData.location}</div>
                        </>
                      )}
                      {userData.company && (
                        <>
                          <div>•</div>
                          <div>🏢 {userData.company}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Repositories Grid */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold text-white flex items-center gap-2">
                      <FolderGit2 className="w-4 h-4 text-indigo-400" />
                      Недавние репозитории ({repos.length})
                    </h4>
                    <span className="text-xs text-slate-400">Отсортировано по дате обновления</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {repos.map((repo) => (
                      <div
                        key={repo.id}
                        className="bg-slate-900/90 rounded-xl border border-slate-800 p-4 hover:border-slate-700 transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <a
                              href={repo.html_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-1.5 break-all"
                            >
                              <GitBranch className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              {repo.name}
                            </a>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                              {repo.private ? 'Private' : 'Public'}
                            </span>
                          </div>

                          <p className="mt-2 text-xs text-slate-400 line-clamp-2 min-h-[2rem]">
                            {repo.description || 'Описание отсутствует.'}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-3">
                            {repo.language && (
                              <span className="flex items-center gap-1 text-slate-300">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                {repo.language}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-400" />
                              {repo.stargazers_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitFork className="w-3 h-3 text-slate-400" />
                              {repo.forks_count}
                            </span>
                          </div>

                          <button
                            onClick={() => copyToClipboard(`git clone ${repo.html_url}.git`, `clone-${repo.id}`)}
                            title="Скопировать команду git clone"
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {copiedKey === `clone-${repo.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GITHUB OAUTH */}
        {activeTab === 'oauth' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                <Key className="w-5 h-5 text-indigo-400" />
                Как настроить вход через GitHub (GitHub OAuth 2.0)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Если вы хотите, чтобы посетители вашего приложения могли авторизоваться через свой аккаунт GitHub, выполните следующие шаги:
              </p>

              {/* Step list */}
              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Шаг 1</span>
                    <a
                      href="https://github.com/settings/applications/new"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                      Открыть регистрацию OAuth App на GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <h4 className="text-sm font-semibold text-white mt-1">Зарегистрируйте новое приложение в GitHub</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Перейдите в <strong className="text-slate-200">GitHub → Settings → Developer settings → OAuth Apps → New OAuth App</strong> и укажите:
                  </p>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[11px]">Homepage URL:</span>
                      <span className="text-emerald-400 break-all">{currentOrigin}</span>
                    </div>
                    <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-500 block text-[11px]">Authorization callback URL:</span>
                      <span className="text-emerald-400 break-all">{currentOrigin}/api/auth/github/callback</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Шаг 2</span>
                  <h4 className="text-sm font-semibold text-white mt-1">Получите Client ID и Client Secret</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    После создания приложения скопируйте <strong className="text-slate-200">Client ID</strong> и нажмите <strong className="text-slate-200">Generate a new client secret</strong>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Шаг 3</span>
                  <h4 className="text-sm font-semibold text-white mt-1">Архитектура OAuth 2.0 потока</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-3">
                    По соображениям безопасности GitHub не позволяет клиенту обменивать <code className="text-indigo-300">code</code> на <code className="text-indigo-300">token</code> без Client Secret, поэтому обмен делается через ваш бэкенд:
                  </p>

                  <pre className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`// 1. Клиент перенаправляет пользователя на GitHub:
const clientId = "ВАШ_CLIENT_ID";
const redirectUri = encodeURIComponent("${currentOrigin}/api/auth/github/callback");
window.location.href = \`https://github.com/login/oauth/authorize?client_id=\${clientId}&redirect_uri=\${redirectUri}&scope=read:user,repo\`;

// 2. На бэкенде (Express / Node.js) принимаем code и получаем токен:
app.get('/api/auth/github/callback', async (req, res) => {
  const code = req.query.code;
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = await tokenResponse.json();
  const accessToken = data.access_token;
  // Теперь можно запросить профиль: GET https://api.github.com/user
  res.redirect(\`/?token=\${accessToken}\`);
});`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FAQ & GUIDE */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                Часто задаваемые вопросы о GitHub в Google AI Studio
              </h2>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-200">
                    В: Могу ли я продолжать редактировать код в AI Studio после пуша на GitHub?
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Да! Вы можете как писать промпты здесь в AI Studio, так и пушить изменения в GitHub, или скачивать обновления.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-200">
                    В: Как бесплатно захостить сайт из GitHub?
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Проще всего использовать <strong>Vercel</strong> или <strong>Cloudflare Pages</strong>: подключите ваш GitHub аккаунт, выберите репозиторий, и они автоматически выполнят <code className="text-indigo-300">npm run build</code> и дадут вам публичный бесплатный домен с HTTPS.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-200">
                    В: Где хранить секретные ключи при публикации в GitHub?
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Никогда не добавляйте файлы <code className="text-rose-400">.env</code> с реальными ключами в git. В репозитории должен быть только <code className="text-indigo-300">.env.example</code>. В Vercel, Netlify или GitHub Actions ключи добавляются в разделе <em>Environment Variables / Secrets</em>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <h4 className="text-sm font-semibold text-slate-200">
                    В: Что вы хотите реализовать в этом приложении?
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Вы можете сказать мне, что именно хотите построить:
                    например, «сделай дашборд для отслеживания GitHub Issue», «добавь авторизацию через GitHub в приложении», «сделай генератор README и аналитику коммитов» — и я напишу весь код!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/60 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <Github className="w-4 h-4 text-slate-400" />
            <span>AI Studio ↔ GitHub Integration Hub</span>
          </div>
          <div>
            Работает на React + Vite + Tailwind CSS & GitHub REST API
          </div>
        </div>
      </footer>
    </div>
  );
}
