import './style.css';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { getVscodeButtonState } from './vscode-button-state.js';
marked.setOptions({breaks: true, gfm: true});

let pdfjsPromise;
let mammothPromise;
let highlightPromise;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/build/pdf.mjs'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsLib, worker]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

async function getMammoth() {
  if (!mammothPromise) mammothPromise = import('mammoth/mammoth.browser').then((module) => module.default || module);
  return mammothPromise;
}

async function getHighlight() {
  if (!highlightPromise) highlightPromise = import('highlight.js/lib/common').then((module) => module.default || module);
  return highlightPromise;
}

const STATE_FILE = '.cairn-workspace.json';
const LEGACY_STATE_FILE = '.learning-workspace.json';
const STATE_FILES = [STATE_FILE, LEGACY_STATE_FILE];
const SIDEBAR_WIDTH_KEY = 'learning-workspace-sidebar-width';
const SIDEBAR_COLLAPSED_KEY = 'learning-workspace-sidebar-collapsed';
const THEME_KEY = 'learning-workspace-theme';
const THEME_MODE_KEY = 'learning-workspace-theme-mode';
const LANGUAGE_KEY = 'learning-workspace-language';
const GITHUB_REPOSITORY_URL = 'https://github.com/kiwiwu02/Cairn';
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 420;
const VSCODE_BRIDGE_URL = 'http://127.0.0.1:4317';
const VSCODE_BRIDGE_TIMEOUT = 1800;
const VSCODE_ROOT_SELECT_TIMEOUT = 120000;
const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build', '.cache', '.next', '.vite']);
const LEARNING_LABELS = {
  unlearned: '未学习',
  learning: '学习中',
  understood: '已理解',
  mastered: '已掌握',
  review: '待复习',
};
const LEARNING_LABELS_EN = {
  unlearned: 'Unlearned',
  learning: 'Learning',
  understood: 'Understood',
  mastered: 'Mastered',
  review: 'Review',
};
const TRANSLATIONS = {
  zh: {
    brandFull: 'Cairn · Mark Your Way to Mastery',
    brandName: 'Cairn',
    documentTitle: 'Cairn · 记录通往精通的每一步',
    brandTagline: '记录通往精通的每一步',
    brandTaglineSecondary: 'Mark Your Way to Mastery.',
    fileTree: '本地文件树',
    returnDashboard: '返回学习工作台',
    collapseTree: '收起文件树',
    expandTree: '展开文件树',
    searchPlaceholder: '搜索文件或路径',
    addLocalFolder: '添加本地文件夹',
    emptyFolderHint: '选择一个文件夹开始管理学习资料',
    openLocalFolder: '打开本地文件夹',
    currentLibrary: '当前学习库',
    noFolderSelected: '未选择文件夹',
    moreActions: '更多操作',
    workspaceActions: '工作区操作',
    changeFolder: '更换文件夹',
    theme: '主题',
    showExample: '查看示例',
    starPromptTitle: '喜欢 Cairn？',
    starPromptMessage: '如果它对你有帮助，欢迎在 GitHub 点个 Star。',
    starPromptStar: '去 GitHub 点 Star',
    starPromptLater: '暂不提示',
    adjustTreeWidth: '调整文件树宽度',
    todoList: '计划',
    overview: '学习概览',
    overviewProgress: '学习进度',
    overviewProgressEmpty: '打开学习库后显示',
    overviewProgressMeta: '{studied}/{total} 个文件',
    overviewProgressAction: '查看已学习内容',
    overviewProgressModalTitle: '已学习内容',
    overviewProgressModalHint: '共 {count} 个文件已记录学习状态',
    overviewProgressModalEmpty: '还没有已学习内容，记录一次学习后会显示在这里。',
    overviewRecent: '最近学习',
    overviewRecentEmpty: '还没有学习记录',
    overviewRecentMeta: '{path} · {time}',
    overviewRecentAction: '打开最近学习的文件',
    overviewRecentDisabled: '还没有可打开的学习记录',
    overviewReview: '待复习',
    overviewReviewEmpty: '打开学习库后显示',
    overviewReviewFiles: '个文件',
    overviewReviewAction: '查看待复习列表',
    overviewReviewModalTitle: '待复习',
    overviewReviewModalHint: '共 {count} 个文件等待复习',
    overviewReviewModalEmpty: '当前没有待复习文件。',
    overviewFileOpen: '打开文件',
    overviewStudySessions: '{count} 次学习',
    overviewLastStudy: '最近学习 {time}',
    overviewNextReview: '下次复习 {date}',
    closeOverview: '关闭学习概览',
    noLibrary: '还没有打开学习库',
    add: '添加',
    emptyTodoOpenLibrary: '打开文件夹后管理待办事项。',
    studyRecords: '学习记录',
    noStudyRecords: '还没有学习记录',
    studyRecordsHint: '每次记录学习后，这里会汇总所有文件的学习历史。',
    currentFileActions: '当前文件操作',
    learningManagement: '学习管理',
    immersiveLearning: '沉浸式学习',
    openInVscode: '在 VS Code 中打开',
    loadingFile: '正在加载文件…',
    exitImmersive: '退出沉浸式',
    addTodo: '添加 Todo',
    todoModalHint: '只保存待办内容和计划日期。',
    close: '关闭',
    todoContent: '待办内容',
    todoPlaceholder: '例如：整理今天的学习笔记',
    plannedDate: '计划日期',
    cancel: '取消',
    learningModalHint: '主动记录一次学习，状态和备注可以在下次继续更新。',
    closeLearningManagement: '关闭学习管理',
    learningStatus: '学习状态',
    learningNoteOptional: '学习备注（可选）',
    learningNotePlaceholder: '记录这次学习的重点、疑问或下一步',
    nextReview: '下次复习',
    recordStudy: '记录本次学习',
    zeroSessions: '0 次',
    selectTheme: '选择主题',
    themeModalHint: '可选择主题色、显示模式和界面语言。',
    closeTheme: '关闭主题选择',
    displayMode: '显示模式',
    day: '日间',
    night: '夜间',
    language: '界面语言',
    chinese: '中文',
    english: 'English',
    themeColor: '主题色',
    theme_orange: '橙色',
    theme_blue: '蓝色',
    theme_violet: '紫色',
    theme_rose: '玫红色',
    theme_indigo: '靛蓝色',
    theme_mint: '薄荷绿',
    theme_pink: '粉红色',
    theme_gray: '灰色',
    theme_monochrome: '黑白',
    notRecorded: '未记录',
    dateNotSet: '未设置日期',
    unmarkedStatus: '未标记状态',
    vscodeRequestFailed: 'VS Code 助手请求失败（{status}）',
    cancelledRoot: '已取消目录选择',
    vscodeAssistantUnavailable: 'VS Code 打开助手未启动，请先运行 README 中的桥接命令。',
    vscodeButtonUnavailable: '当前版暂不支持 VS Code 关联，请从 Github 克隆到本地使用此功能',
    vscodeBridgeForbidden: '本地桥接服务未放行当前站点，已改用浏览器选择文件夹。需要「在 VS Code 中打开」时，重启桥接并追加 --allow-origin {origin}',
    vscodeBindingMismatch: 'VS Code 助手绑定的是“{bound}”，当前文件夹是“{current}”，请重新点击“打开本地文件夹”并选择同一个目录。',
    openVscodeSuccess: '已在 VS Code 中打开当前文件',
    openVscodeFailed: '无法在 VS Code 中打开文件',
    workspaceCorrupt: '学习状态文件格式损坏，请先备份后处理。',
    openAssociated: '已打开并关联 VS Code：{root}',
    browserFolderUnsupported: '当前浏览器不支持本地文件夹访问，请使用最新版 Chrome 或 Edge。',
    openLocalSuccess: '已打开本地学习库：{root}（未关联 VS Code）',
    openFolderFailed: '打开本地文件夹失败',
    demoFileLoadFailed: '示例文件加载失败',
    demoReadFailed: '示例文件读取失败',
    localFileReadFailed: '本地文件读取失败',
    demoEntered: '已进入示例学习库',
    noMatchingFiles: '没有找到匹配的文件。',
    currentLibraryTitle: '当前学习库：{root}',
    noLibraryTitle: '还没有打开学习库',
    rootActionChange: '更换文件夹',
    rootActionOpen: '打开本地文件夹',
    todoRemaining: '{count} 项未完成',
    noTodayTodos: '今天没有待办事项',
    emptyTodayTodos: '今天没有待办事项。',
    todoPlanDate: '计划 {date}',
    markIncomplete: '标记为未完成',
    markComplete: '标记为已完成',
    delete: '删除',
    studyCount: '共记录 {count} 次',
    fileStudyCount: '{count} 次',
    pleaseOpenLibrary: '请先打开本地文件夹，或进入示例学习库。',
    todoAdded: '已添加 Todo',
    saveTodoFailed: '保存 Todo 失败',
    deleteTodoConfirm: '确定删除这个 Todo 吗？',
    deleteTodoFailed: '删除 Todo 失败',
    noFileStudy: '还没有学习记录。',
    recordedStudy: '已记录本次学习',
    saveStudyFailed: '保存学习记录失败',
    deleteStudyConfirm: '确定删除这条学习记录吗？删除后会按剩余记录恢复学习状态。',
    deletedStudy: '已删除学习记录',
    deleteStudyFailed: '删除学习记录失败',
    loadingContent: '正在加载内容…',
    readingFile: '正在读取文件…',
    notebookTitle: 'Jupyter Notebook',
    notebookMarkdown: 'Markdown 单元',
    notebookCode: '代码单元',
    notebookRaw: '原始单元',
    notebookExecution: '执行次数',
    notebookOutput: '输出',
    notebookEmpty: '这个 Notebook 没有可显示的单元格。',
    notebookInvalid: 'Notebook 文件格式无法解析',
    notebookImageUnavailable: '图片无法加载',
    unsupportedPreview: '暂不支持网页预览',
    unsupportedHint: '你仍然可以记录这个文件的学习状态。',
    fileReadFailed: '文件读取失败',
    unknownError: '未知错误',
    pdfControls: 'PDF 翻页控制',
    previousPage: '上一页',
    nextPage: '下一页',
    switchedTheme: '已切换为{theme}',
    switchedNight: '已切换为夜间模式',
    switchedDay: '已切换为日间模式',
    switchedChinese: '已切换为中文',
    switchedEnglish: 'Switched to English',
  },
  en: {
    brandFull: 'Cairn · Mark Your Way to Mastery',
    brandName: 'Cairn',
    documentTitle: 'Cairn · Mark Your Way to Mastery',
    brandTagline: 'Mark Your Way to Mastery.',
    brandTaglineSecondary: '记录通往精通的每一步',
    fileTree: 'Local file tree',
    returnDashboard: 'Back to workspace',
    collapseTree: 'Collapse file tree',
    expandTree: 'Expand file tree',
    searchPlaceholder: 'Search files or paths',
    addLocalFolder: 'Add local folder',
    emptyFolderHint: 'Choose a folder to manage your learning materials',
    openLocalFolder: 'Open local folder',
    currentLibrary: 'Current library',
    noFolderSelected: 'No folder selected',
    moreActions: 'More actions',
    workspaceActions: 'Workspace actions',
    changeFolder: 'Change folder',
    theme: 'Theme',
    showExample: 'View example',
    starPromptTitle: 'Enjoying Cairn?',
    starPromptMessage: 'If it helps your learning, consider giving it a Star on GitHub.',
    starPromptStar: 'Star on GitHub',
    starPromptLater: 'Not now',
    adjustTreeWidth: 'Adjust file tree width',
    todoList: 'Plans',
    overview: 'Study overview',
    overviewProgress: 'Study progress',
    overviewProgressEmpty: 'Open a library to see progress',
    overviewProgressMeta: '{studied}/{total} files',
    overviewProgressAction: 'View studied files',
    overviewProgressModalTitle: 'Studied files',
    overviewProgressModalHint: '{count} files with a study status',
    overviewProgressModalEmpty: 'No studied files yet. Record a study session to see it here.',
    overviewRecent: 'Latest study',
    overviewRecentEmpty: 'No study sessions yet',
    overviewRecentMeta: '{path} · {time}',
    overviewRecentAction: 'Open the latest studied file',
    overviewRecentDisabled: 'No study record to open yet',
    overviewReview: 'Review queue',
    overviewReviewEmpty: 'Open a library to see the queue',
    overviewReviewFiles: 'files',
    overviewReviewAction: 'View review queue',
    overviewReviewModalTitle: 'Review queue',
    overviewReviewModalHint: '{count} files waiting for review',
    overviewReviewModalEmpty: 'There are no files waiting for review.',
    overviewFileOpen: 'Open file',
    overviewStudySessions: '{count} study sessions',
    overviewLastStudy: 'Last studied {time}',
    overviewNextReview: 'Next review {date}',
    closeOverview: 'Close study overview',
    noLibrary: 'No learning library open',
    add: 'Add',
    emptyTodoOpenLibrary: 'Open a folder to manage todos.',
    studyRecords: 'Study records',
    noStudyRecords: 'No study records yet',
    studyRecordsHint: 'Each study session will be collected here across your files.',
    currentFileActions: 'Current file actions',
    learningManagement: 'Study management',
    immersiveLearning: 'Immersive study',
    openInVscode: 'Open in VS Code',
    loadingFile: 'Loading file…',
    exitImmersive: 'Exit immersive mode',
    addTodo: 'Add Todo',
    todoModalHint: 'Save a todo title and planned date.',
    close: 'Close',
    todoContent: 'Todo',
    todoPlaceholder: 'e.g. Organize today’s study notes',
    plannedDate: 'Planned date',
    cancel: 'Cancel',
    learningModalHint: 'Record one study session and update it again whenever you continue.',
    closeLearningManagement: 'Close study management',
    learningStatus: 'Study status',
    learningNoteOptional: 'Study note (optional)',
    learningNotePlaceholder: 'Record the key idea, question, or next step from this session',
    nextReview: 'Next review',
    recordStudy: 'Record study session',
    zeroSessions: '0 sessions',
    selectTheme: 'Choose theme',
    themeModalHint: 'Choose a theme color, display mode, and interface language.',
    closeTheme: 'Close theme picker',
    displayMode: 'Display mode',
    day: 'Day',
    night: 'Night',
    language: 'Language',
    chinese: '中文',
    english: 'English',
    themeColor: 'Theme color',
    theme_orange: 'Orange',
    theme_blue: 'Blue',
    theme_violet: 'Violet',
    theme_rose: 'Rose',
    theme_indigo: 'Indigo',
    theme_mint: 'Mint',
    theme_pink: 'Pink',
    theme_gray: 'Gray',
    theme_monochrome: 'Monochrome',
    notRecorded: 'Not recorded',
    dateNotSet: 'Date not set',
    unmarkedStatus: 'Unmarked',
    vscodeRequestFailed: 'VS Code assistant request failed ({status})',
    cancelledRoot: 'Folder selection cancelled',
    vscodeAssistantUnavailable: 'The VS Code opener is not running. Start the bridge command from README first.',
    vscodeButtonUnavailable: 'This version does not support VS Code linking. Clone it from Github and run it locally to use this feature.',
    vscodeBridgeForbidden: 'The local bridge did not allow this site, so Cairn used the browser folder picker instead. To enable “Open in VS Code”, restart the bridge with --allow-origin {origin}',
    vscodeBindingMismatch: 'The VS Code assistant is bound to “{bound}”, but the current folder is “{current}”. Choose the same folder with “Open local folder”.',
    openVscodeSuccess: 'Opened the current file in VS Code',
    openVscodeFailed: 'Could not open the file in VS Code',
    workspaceCorrupt: 'The learning state file is damaged. Back it up before continuing.',
    openAssociated: 'Opened and linked VS Code: {root}',
    browserFolderUnsupported: 'This browser cannot access local folders. Use the latest Chrome or Edge.',
    openLocalSuccess: 'Opened local learning library: {root} (not linked to VS Code)',
    openFolderFailed: 'Could not open the local folder',
    demoFileLoadFailed: 'Could not load the example files',
    demoReadFailed: 'Could not read the example file',
    localFileReadFailed: 'Could not read the local file',
    demoEntered: 'Example learning library opened',
    noMatchingFiles: 'No matching files found.',
    currentLibraryTitle: 'Current library: {root}',
    noLibraryTitle: 'No learning library open',
    rootActionChange: 'Change folder',
    rootActionOpen: 'Open local folder',
    todoRemaining: '{count} unfinished',
    noTodayTodos: 'No todos for today',
    emptyTodayTodos: 'No todos for today.',
    todoPlanDate: 'Planned {date}',
    markIncomplete: 'Mark as unfinished',
    markComplete: 'Mark as complete',
    delete: 'Delete',
    studyCount: '{count} study sessions',
    fileStudyCount: '{count} sessions',
    pleaseOpenLibrary: 'Open a local folder or view the example library first.',
    todoAdded: 'Todo added',
    saveTodoFailed: 'Could not save the Todo',
    deleteTodoConfirm: 'Delete this Todo?',
    deleteTodoFailed: 'Could not delete the Todo',
    noFileStudy: 'No study sessions yet.',
    recordedStudy: 'Study session recorded',
    saveStudyFailed: 'Could not save the study session',
    deleteStudyConfirm: 'Delete this study session? The status will be restored from the remaining sessions.',
    deletedStudy: 'Study session deleted',
    deleteStudyFailed: 'Could not delete the study session',
    loadingContent: 'Loading content…',
    readingFile: 'Reading file…',
    notebookTitle: 'Jupyter Notebook',
    notebookMarkdown: 'Markdown cell',
    notebookCode: 'Code cell',
    notebookRaw: 'Raw cell',
    notebookExecution: 'Execution',
    notebookOutput: 'Output',
    notebookEmpty: 'This Notebook has no cells to display.',
    notebookInvalid: 'The Notebook file could not be parsed',
    notebookImageUnavailable: 'Image could not be loaded',
    unsupportedPreview: 'Web preview is not available for this file',
    unsupportedHint: 'You can still record a study status for this file.',
    fileReadFailed: 'Could not read the file',
    unknownError: 'Unknown error',
    pdfControls: 'PDF page controls',
    previousPage: 'Previous',
    nextPage: 'Next',
    switchedTheme: 'Theme changed to {theme}',
    switchedNight: 'Night mode enabled',
    switchedDay: 'Day mode enabled',
    switchedChinese: '已切换为中文',
    switchedEnglish: 'Switched to English',
  },
};
const FILE_TYPES = {
  markdown: new Set(['md', 'markdown', 'mdown', 'mkdn']),
  notebook: new Set(['ipynb']),
  code: new Set(['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'css', 'html', 'vue', 'json', 'yaml', 'yml', 'sh', 'sql']),
  text: new Set(['txt', 'log', 'csv', 'xml', 'toml', 'ini']),
  image: new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']),
};
const THEMES = [
  {
    id: 'orange',
    label: '橙色',
    swatches: ['#181817', '#D97706', '#FFF7ED'],
    variables: {
      '--page': '#f6f6f5', '--surface': '#ffffff', '--surface-soft': '#fafaf9', '--surface-hover': '#fff7ed',
      '--line': '#e5e5e2', '--line-strong': '#c9c9c5', '--text': '#181817', '--muted': '#666560', '--faint': '#92918b',
      '--accent': '#d97706', '--accent-dark': '#b45309', '--accent-soft': '#fff7ed', '--accent-line': '#e7b46f',
      '--focus-ring': 'rgba(217, 119, 6, .22)', '--focus-soft': 'rgba(217, 119, 6, .1)', '--sidebar-surface': '#fbfbfa',
    },
    darkVariables: {
      '--page': '#111110', '--surface': '#1c1c1a', '--surface-soft': '#242421', '--surface-hover': '#302718',
      '--line': '#383833', '--line-strong': '#55544c', '--text': '#f2f1ec', '--muted': '#b8b6ad', '--faint': '#898880',
      '--accent': '#f59e0b', '--accent-dark': '#fbbf24', '--accent-soft': '#3a2b16', '--accent-line': '#8b6428',
      '--focus-ring': 'rgba(245, 158, 11, .28)', '--focus-soft': 'rgba(245, 158, 11, .14)', '--sidebar-surface': '#171715',
    },
  },
  {
    id: 'blue',
    label: '蓝色',
    swatches: ['#172033', '#2563EB', '#EFF6FF'],
    variables: {
      '--page': '#f5f7fb', '--surface': '#ffffff', '--surface-soft': '#fbfcfe', '--surface-hover': '#eff6ff',
      '--line': '#e2e8f0', '--line-strong': '#cbd5e1', '--text': '#172033', '--muted': '#64748b', '--faint': '#94a3b8',
      '--accent': '#2563eb', '--accent-dark': '#1d4ed8', '--accent-soft': '#eff6ff', '--accent-line': '#93c5fd',
      '--focus-ring': 'rgba(37, 99, 235, .22)', '--focus-soft': 'rgba(37, 99, 235, .1)', '--sidebar-surface': '#f8fafc',
    },
    darkVariables: {
      '--page': '#11151d', '--surface': '#1b2330', '--surface-soft': '#222c3a', '--surface-hover': '#1e3553',
      '--line': '#354255', '--line-strong': '#53657d', '--text': '#edf3fc', '--muted': '#b6c2d2', '--faint': '#8897ad',
      '--accent': '#60a5fa', '--accent-dark': '#93c5fd', '--accent-soft': '#1c3049', '--accent-line': '#4679aa',
      '--focus-ring': 'rgba(96, 165, 250, .28)', '--focus-soft': 'rgba(96, 165, 250, .14)', '--sidebar-surface': '#151c26',
    },
  },
  {
    id: 'violet',
    label: '紫色',
    swatches: ['#251D35', '#7C3AED', '#F5F3FF'],
    variables: {
      '--page': '#faf9fe', '--surface': '#ffffff', '--surface-soft': '#fcfbff', '--surface-hover': '#f5f3ff',
      '--line': '#e9e4f5', '--line-strong': '#d8cff0', '--text': '#251d35', '--muted': '#6b5f7f', '--faint': '#9b91aa',
      '--accent': '#7c3aed', '--accent-dark': '#6d28d9', '--accent-soft': '#f5f3ff', '--accent-line': '#c4b5fd',
      '--focus-ring': 'rgba(124, 58, 237, .22)', '--focus-soft': 'rgba(124, 58, 237, .1)', '--sidebar-surface': '#faf9fe',
    },
    darkVariables: {
      '--page': '#14111d', '--surface': '#211b2d', '--surface-soft': '#29233a', '--surface-hover': '#39264b',
      '--line': '#403753', '--line-strong': '#5d5073', '--text': '#f2eefc', '--muted': '#c0b7d2', '--faint': '#958aa9',
      '--accent': '#a78bfa', '--accent-dark': '#c4b5fd', '--accent-soft': '#30234a', '--accent-line': '#735bb2',
      '--focus-ring': 'rgba(167, 139, 250, .28)', '--focus-soft': 'rgba(167, 139, 250, .14)', '--sidebar-surface': '#1b1726',
    },
  },
  {
    id: 'rose',
    label: '玫红色',
    swatches: ['#2B1A1E', '#E11D48', '#FFF1F2'],
    variables: {
      '--page': '#fffafa', '--surface': '#ffffff', '--surface-soft': '#fffdfd', '--surface-hover': '#fff1f2',
      '--line': '#f0e3e6', '--line-strong': '#e4cdd2', '--text': '#2b1a1e', '--muted': '#766166', '--faint': '#a89197',
      '--accent': '#e11d48', '--accent-dark': '#be123c', '--accent-soft': '#fff1f2', '--accent-line': '#fda4af',
      '--focus-ring': 'rgba(225, 29, 72, .22)', '--focus-soft': 'rgba(225, 29, 72, .1)', '--sidebar-surface': '#fffafa',
    },
    darkVariables: {
      '--page': '#1a1013', '--surface': '#27171b', '--surface-soft': '#322026', '--surface-hover': '#47232e',
      '--line': '#4b3036', '--line-strong': '#6d4a53', '--text': '#f8edf0', '--muted': '#c9b5ba', '--faint': '#9f858c',
      '--accent': '#fb7185', '--accent-dark': '#fda4af', '--accent-soft': '#45212c', '--accent-line': '#a14b5c',
      '--focus-ring': 'rgba(251, 113, 133, .28)', '--focus-soft': 'rgba(251, 113, 133, .14)', '--sidebar-surface': '#211417',
    },
  },
  {
    id: 'indigo',
    label: '靛蓝色',
    swatches: ['#1E1B4B', '#4F46E5', '#EEF2FF'],
    variables: {
      '--page': '#f7f8fc', '--surface': '#ffffff', '--surface-soft': '#fbfbfe', '--surface-hover': '#eef2ff',
      '--line': '#e1e4f0', '--line-strong': '#c7cbe0', '--text': '#1e1b4b', '--muted': '#626581', '--faint': '#9498af',
      '--accent': '#4f46e5', '--accent-dark': '#4338ca', '--accent-soft': '#eef2ff', '--accent-line': '#a5b4fc',
      '--focus-ring': 'rgba(79, 70, 229, .22)', '--focus-soft': 'rgba(79, 70, 229, .1)', '--sidebar-surface': '#f7f8fc',
    },
    darkVariables: {
      '--page': '#111125', '--surface': '#1c1c32', '--surface-soft': '#252540', '--surface-hover': '#302f55',
      '--line': '#3b3b5b', '--line-strong': '#5b5b83', '--text': '#eef0ff', '--muted': '#b7bad9', '--faint': '#8e91b3',
      '--accent': '#818cf8', '--accent-dark': '#a5b4fc', '--accent-soft': '#29284e', '--accent-line': '#666ac0',
      '--focus-ring': 'rgba(129, 140, 248, .28)', '--focus-soft': 'rgba(129, 140, 248, .14)', '--sidebar-surface': '#16162d',
    },
  },
  {
    id: 'mint',
    label: '薄荷绿',
    swatches: ['#16352D', '#0F9F78', '#E7F7F1'],
    variables: {
      '--page': '#f3faf7', '--surface': '#ffffff', '--surface-soft': '#f7fcfa', '--surface-hover': '#e7f7f1',
      '--line': '#dcece6', '--line-strong': '#b9d8cc', '--text': '#16352d', '--muted': '#5e756c', '--faint': '#8aa39a',
      '--accent': '#0f9f78', '--accent-dark': '#087f63', '--accent-soft': '#e7f7f1', '--accent-line': '#8fd5c0',
      '--focus-ring': 'rgba(15, 159, 120, .22)', '--focus-soft': 'rgba(15, 159, 120, .1)', '--sidebar-surface': '#f7fcfa',
    },
    darkVariables: {
      '--page': '#0d1b17', '--surface': '#142721', '--surface-soft': '#1b332a', '--surface-hover': '#1d4639',
      '--line': '#2b4b40', '--line-strong': '#41695a', '--text': '#e6f6ef', '--muted': '#adcbbf', '--faint': '#7f9f93',
      '--accent': '#4fd1ab', '--accent-dark': '#8be3c6', '--accent-soft': '#1b4035', '--accent-line': '#3b8f79',
      '--focus-ring': 'rgba(79, 209, 171, .28)', '--focus-soft': 'rgba(79, 209, 171, .14)', '--sidebar-surface': '#11211c',
    },
  },
  {
    id: 'pink',
    label: '粉红色',
    swatches: ['#3B1C2D', '#DB5B8A', '#FFF0F5'],
    variables: {
      '--page': '#fff7fa', '--surface': '#ffffff', '--surface-soft': '#fffafd', '--surface-hover': '#fff0f5',
      '--line': '#f1e0e8', '--line-strong': '#e2c4d2', '--text': '#3b1c2d', '--muted': '#765769', '--faint': '#a98c9c',
      '--accent': '#db5b8a', '--accent-dark': '#b83f6b', '--accent-soft': '#fff0f5', '--accent-line': '#edabc2',
      '--focus-ring': 'rgba(219, 91, 138, .22)', '--focus-soft': 'rgba(219, 91, 138, .1)', '--sidebar-surface': '#fffafd',
    },
    darkVariables: {
      '--page': '#1e1119', '--surface': '#2a1823', '--surface-soft': '#38202d', '--surface-hover': '#4a2539',
      '--line': '#503142', '--line-strong': '#75465c', '--text': '#faedf4', '--muted': '#d2b5c2', '--faint': '#a88b99',
      '--accent': '#f58ab0', '--accent-dark': '#ffc0d5', '--accent-soft': '#4b2338', '--accent-line': '#a9617c',
      '--focus-ring': 'rgba(245, 138, 176, .28)', '--focus-soft': 'rgba(245, 138, 176, .14)', '--sidebar-surface': '#24151e',
    },
  },
  {
    id: 'gray',
    label: '灰色',
    swatches: ['#374151', '#6B7280', '#F3F4F6'],
    variables: {
      '--page': '#f5f6f7', '--surface': '#ffffff', '--surface-soft': '#fafafa', '--surface-hover': '#f3f4f6',
      '--line': '#e5e7eb', '--line-strong': '#cfd4dc', '--text': '#1f2937', '--muted': '#6b7280', '--faint': '#9ca3af',
      '--accent': '#6b7280', '--accent-dark': '#4b5563', '--accent-soft': '#f3f4f6', '--accent-line': '#c4cbd4',
      '--focus-ring': 'rgba(107, 114, 128, .22)', '--focus-soft': 'rgba(107, 114, 128, .1)', '--sidebar-surface': '#f8f9fa',
    },
    darkVariables: {
      '--page': '#15171a', '--surface': '#1f2227', '--surface-soft': '#282c32', '--surface-hover': '#333840',
      '--line': '#3a4048', '--line-strong': '#555d68', '--text': '#eef0f2', '--muted': '#b3bac4', '--faint': '#8b939e',
      '--accent': '#aab3bf', '--accent-dark': '#d1d5db', '--accent-soft': '#31363d', '--accent-line': '#68717d',
      '--focus-ring': 'rgba(170, 179, 191, .28)', '--focus-soft': 'rgba(170, 179, 191, .14)', '--sidebar-surface': '#191c20',
    },
  },
  {
    id: 'monochrome',
    label: '黑白',
    swatches: ['#111111', '#666666', '#F5F5F5'],
    variables: {
      '--page': '#f3f3f3', '--surface': '#ffffff', '--surface-soft': '#fafafa', '--surface-hover': '#eeeeee',
      '--line': '#dedede', '--line-strong': '#aaaaaa', '--text': '#111111', '--muted': '#666666', '--faint': '#999999',
      '--accent': '#111111', '--accent-dark': '#000000', '--accent-soft': '#eeeeee', '--accent-line': '#999999', '--accent-foreground': '#ffffff',
      '--focus-ring': 'rgba(0, 0, 0, .2)', '--focus-soft': 'rgba(0, 0, 0, .08)', '--sidebar-surface': '#fafafa',
    },
    darkVariables: {
      '--page': '#0f0f0f', '--surface': '#191919', '--surface-soft': '#242424', '--surface-hover': '#303030',
      '--line': '#3c3c3c', '--line-strong': '#5c5c5c', '--text': '#f2f2f2', '--muted': '#bdbdbd', '--faint': '#898989',
      '--accent': '#e5e5e5', '--accent-dark': '#ffffff', '--accent-soft': '#343434', '--accent-line': '#858585', '--accent-foreground': '#111111',
      '--focus-ring': 'rgba(255, 255, 255, .25)', '--focus-soft': 'rgba(255, 255, 255, .12)', '--sidebar-surface': '#151515',
    },
  },
];

const LIGHT_THEME_SUPPORT_VARIABLES = {
  '--tree-text': '#3f3f3c', '--tree-children-line': '#e9e9e6', '--scrollbar-track': '#fbfbfa', '--scrollbar-thumb': '#c8c8c4',
  '--mastered-dot': '#252523', '--reader-surface': '#ffffff', '--reader-text': '#30302d', '--reader-inline-code': '#f2f2ef',
  '--reader-code-surface': '#20201e', '--reader-code-text': '#f7f7f4', '--reader-toolbar-surface': 'rgba(255, 255, 255, .92)',
  '--reader-divider': 'rgba(224, 224, 220, .9)', '--accent-foreground': '#ffffff', '--danger': '#b55454', '--danger-soft': '#fff4f4', '--danger-line': '#e5b8b8',
};

const DARK_THEME_SUPPORT_VARIABLES = {
  '--tree-text': '#d8d7d0', '--tree-children-line': '#3b3b35', '--scrollbar-track': '#171715', '--scrollbar-thumb': '#57564f',
  '--mastered-dot': '#f0efe9', '--reader-surface': '#1b1b19', '--reader-text': '#deddd6', '--reader-inline-code': '#2c2b27',
  '--reader-code-surface': '#0f0f0e', '--reader-code-text': '#f1f0ea', '--reader-toolbar-surface': 'rgba(27, 27, 25, .94)',
  '--reader-divider': 'rgba(75, 74, 67, .9)', '--accent-foreground': '#ffffff', '--danger': '#fca5a5', '--danger-soft': '#3b2020', '--danger-line': '#7f3f3f',
};

const state = {
  mode: 'empty',
  localSource: null,
  rootHandle: null,
  rootName: '',
  tree: null,
  fileByPath: new Map(),
  workspace: createWorkspaceState(),
  selectedPath: null,
  selectedFile: null,
  expanded: new Set(['']),
  search: '',
  readerToken: 0,
  objectUrl: null,
  notebookObjectUrls: [],
  pdf: null,
  draft: null,
  immersive: false,
  legacyStateFile: false,
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  dashboardButton: $('#dashboardButton'),
  sidebarCurrentTitle: $('#sidebarCurrentTitle'),
  sidebarMoreButton: $('#sidebarMoreButton'),
  sidebarMenu: $('#sidebarMenu'),
  demoButton: $('#demoButton'),
  themeButton: $('#themeButton'),
  openFolderButton: $('#openFolderButton'),
  sidebarRootFooter: $('#sidebarRootFooter'),
  sidebarRootName: $('#sidebarRootName'),
  sidebarRootActionIcon: $('#sidebarRootActionIcon'),
  sidebarRootActionLabel: $('#sidebarRootActionLabel'),
  searchInput: $('#searchInput'),
  tree: $('#tree'),
  treeEmptyState: $('#treeEmptyState'),
  emptyOpenFolderButton: $('#emptyOpenFolderButton'),
  emptyDemoButton: $('#emptyDemoButton'),
  starPrompt: $('#starPrompt'),
  starPromptButton: $('#starPromptButton'),
  starPromptLaterButton: $('#starPromptLaterButton'),
  sidebarToggle: $('#sidebarToggle'),
  sidebarExpandButton: $('#sidebarExpandButton'),
  sidebarResizer: $('#sidebarResizer'),
  dashboardView: $('#dashboardView'),
  dashboardOverview: $('#dashboardOverview'),
  overviewProgressButton: $('#overviewProgressButton'),
  overviewRecentButton: $('#overviewRecentButton'),
  overviewReviewButton: $('#overviewReviewButton'),
  overviewProgressValue: $('#overviewProgressValue'),
  overviewProgressMeta: $('#overviewProgressMeta'),
  overviewRecentValue: $('#overviewRecentValue'),
  overviewRecentMeta: $('#overviewRecentMeta'),
  overviewReviewValue: $('#overviewReviewValue'),
  overviewReviewMeta: $('#overviewReviewMeta'),
  overviewModal: $('#overviewModal'),
  overviewModalTitle: $('#overviewModalTitle'),
  overviewModalHint: $('#overviewModalHint'),
  closeOverviewModalButton: $('#closeOverviewModalButton'),
  overviewModalList: $('#overviewModalList'),
  fileView: $('#fileView'),
  todoSummary: $('#todoSummary'),
  todoList: $('#todoList'),
  studySummary: $('#studySummary'),
  globalStudyList: $('#globalStudyList'),
  addTodoButton: $('#addTodoButton'),
  todoModal: $('#todoModal'),
  closeTodoModalButton: $('#closeTodoModalButton'),
  cancelTodoButton: $('#cancelTodoButton'),
  todoForm: $('#todoForm'),
  todoInput: $('#todoInput'),
  todoDate: $('#todoDate'),
  learningModal: $('#learningModal'),
  closeLearningModalButton: $('#closeLearningModalButton'),
  immersiveButton: $('#immersiveButton'),
  immersiveExitButton: $('#immersiveExitButton'),
  openLearningButton: $('#openLearningButton'),
  readerFileName: $('#readerFileName'),
  readerPath: $('#readerPath'),
  openVscodeTooltip: $('#openVscodeTooltip'),
  openVscodeButton: $('#openVscodeButton'),
  openVscodeTooltipText: $('#openVscodeTooltipText'),
  readerContent: $('#readerContent'),
  statusButtons: $('#statusButtons'),
  noteInput: $('#noteInput'),
  reviewRow: $('#reviewRow'),
  reviewDate: $('#reviewDate'),
  recordStudyButton: $('#recordStudyButton'),
  fileStudySummary: $('#fileStudySummary'),
  fileStudyList: $('#fileStudyList'),
  themeModal: $('#themeModal'),
  closeThemeModalButton: $('#closeThemeModalButton'),
  lightThemeModeButton: $('#lightThemeModeButton'),
  darkThemeModeButton: $('#darkThemeModeButton'),
  zhLanguageButton: $('#zhLanguageButton'),
  enLanguageButton: $('#enLanguageButton'),
  themeOptions: $('#themeOptions'),
  toast: $('#toast'),
};

function currentLanguage() {
  return document.documentElement.dataset.language === 'en' ? 'en' : 'zh';
}

function t(key, values = {}) {
  const template = TRANSLATIONS[currentLanguage()][key] || TRANSLATIONS.zh[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
}

function learningLabel(status) {
  const labels = currentLanguage() === 'en' ? LEARNING_LABELS_EN : LEARNING_LABELS;
  return labels[status] || t('unmarkedStatus');
}

function translateStaticUi() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
}

function createWorkspaceState() {
  return {version: 1, updatedAt: null, files: {}, todos: []};
}

function themeById(themeId) {
  return THEMES.find((theme) => theme.id === themeId) || THEMES[0];
}

function applyTheme(themeId, mode = 'light', persist = true) {
  const theme = themeById(themeId);
  const activeMode = mode === 'dark' ? 'dark' : 'light';
  const themeVariables = activeMode === 'dark' ? theme.darkVariables : theme.variables;
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.dataset.themeMode = activeMode;
  document.documentElement.style.colorScheme = activeMode;
  const supportVariables = {...(activeMode === 'dark' ? DARK_THEME_SUPPORT_VARIABLES : LIGHT_THEME_SUPPORT_VARIABLES)};
  for (const [property, value] of Object.entries({...supportVariables, ...themeVariables})) {
    document.documentElement.style.setProperty(property, value);
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeVariables['--accent-soft']);
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, theme.id);
      localStorage.setItem(THEME_MODE_KEY, activeMode);
    } catch {
      // 隐私模式下 localStorage 可能不可用，主题仍会在当前页面生效。
    }
  }
}

function initializeTheme() {
  let savedTheme = THEMES[0].id;
  let savedMode = 'light';
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || savedTheme;
    savedMode = localStorage.getItem(THEME_MODE_KEY) === 'dark' ? 'dark' : savedMode;
    if (savedTheme === 'dark') {
      // 兼容上一版把夜间模式当作独立主题时留下的浏览器设置。
      savedTheme = THEMES[0].id;
      savedMode = 'dark';
    }
  } catch {
    // 隐私模式下 localStorage 可能不可用，使用默认主题。
  }
  applyTheme(savedTheme, savedMode, false);
}

function themeLabel(theme) {
  return currentLanguage() === 'en' ? t(`theme_${theme.id}`) : theme.label;
}

function renderThemeOptions() {
  const activeTheme = document.documentElement.dataset.theme || THEMES[0].id;
  const activeMode = document.documentElement.dataset.themeMode || 'light';
  const activeLanguage = currentLanguage();
  ui.lightThemeModeButton.classList.toggle('active', activeMode === 'light');
  ui.darkThemeModeButton.classList.toggle('active', activeMode === 'dark');
  ui.lightThemeModeButton.setAttribute('aria-pressed', String(activeMode === 'light'));
  ui.darkThemeModeButton.setAttribute('aria-pressed', String(activeMode === 'dark'));
  ui.zhLanguageButton.classList.toggle('active', activeLanguage === 'zh');
  ui.enLanguageButton.classList.toggle('active', activeLanguage === 'en');
  ui.zhLanguageButton.setAttribute('aria-pressed', String(activeLanguage === 'zh'));
  ui.enLanguageButton.setAttribute('aria-pressed', String(activeLanguage === 'en'));
  ui.themeOptions.innerHTML = '';
  for (const theme of THEMES) {
    const label = themeLabel(theme);
    const option = document.createElement('button');
    option.className = `theme-option ${theme.id === activeTheme ? 'active' : ''}`;
    option.type = 'button';
    option.setAttribute('aria-pressed', String(theme.id === activeTheme));
    option.addEventListener('click', () => {
      applyTheme(theme.id, document.documentElement.dataset.themeMode || 'light');
      renderThemeOptions();
      showToast(t('switchedTheme', {theme: label}));
    });

    const header = document.createElement('span');
    header.className = 'theme-option-header';
    const title = document.createElement('strong');
    title.textContent = label;
    const mark = document.createElement('span');
    mark.className = 'theme-option-mark';
    mark.textContent = theme.id === activeTheme ? '✓' : '';
    header.append(title, mark);

    const swatches = document.createElement('span');
    swatches.className = 'theme-swatches';
    const swatch = document.createElement('span');
    swatch.className = 'theme-swatch';
    const activeThemeVariables = activeMode === 'dark' ? theme.darkVariables : theme.variables;
    const accentColor = activeThemeVariables['--accent'];
    swatch.style.backgroundColor = accentColor;
    swatch.title = accentColor;
    swatch.setAttribute('aria-label', currentLanguage() === 'en' ? `${label} accent ${accentColor}` : `${label}主题色 ${accentColor}`);
    swatches.appendChild(swatch);
    option.append(header, swatches);
    ui.themeOptions.appendChild(option);
  }
}

function setThemeMode(mode) {
  const activeTheme = document.documentElement.dataset.theme || THEMES[0].id;
  const activeMode = mode === 'dark' ? 'dark' : 'light';
  applyTheme(activeTheme, activeMode);
  renderThemeOptions();
  showToast(activeMode === 'dark' ? t('switchedNight') : t('switchedDay'));
}

function applyLanguage(language, persist = true) {
  const activeLanguage = language === 'en' ? 'en' : 'zh';
  document.documentElement.dataset.language = activeLanguage;
  document.documentElement.lang = activeLanguage === 'en' ? 'en' : 'zh-CN';
  document.title = t('documentTitle');
  translateStaticUi();
  updateVscodeButton();
  const pdfToolbar = document.querySelector('.pdf-toolbar');
  if (pdfToolbar) {
    pdfToolbar.setAttribute('aria-label', t('pdfControls'));
    $('#pdfPrevious').textContent = t('previousPage');
    $('#pdfNext').textContent = t('nextPage');
  }
  if (state.tree) renderTree();
  if (!ui.dashboardView.classList.contains('hidden')) {
    renderDashboardOverview();
    renderTodoList();
    renderGlobalStudyList();
  }
  if (!ui.overviewModal.classList.contains('hidden')) renderOverviewModalList(ui.overviewModal.dataset.kind || 'studied');
  if (state.selectedPath && !ui.learningModal.classList.contains('hidden')) renderLearningPanel();
  if (!ui.themeModal.classList.contains('hidden')) renderThemeOptions();
  if (persist) {
    try {
      localStorage.setItem(LANGUAGE_KEY, activeLanguage);
    } catch {
      // 隐私模式下 localStorage 可能不可用，语言仍会在当前页面生效。
    }
  }
}

function initializeLanguage() {
  let savedLanguage = 'zh';
  try {
    savedLanguage = localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : savedLanguage;
  } catch {
    // 隐私模式下 localStorage 可能不可用，使用默认语言。
  }
  applyLanguage(savedLanguage, false);
}

function setLanguage(language) {
  applyLanguage(language);
  showToast(language === 'en' ? t('switchedEnglish') : t('switchedChinese'));
}

function openThemeModal() {
  renderThemeOptions();
  ui.themeModal.classList.remove('hidden');
  requestAnimationFrame(() => ui.themeOptions.querySelector('.active')?.focus());
}

function closeThemeModal() {
  ui.themeModal.classList.add('hidden');
}

function sidebarWidthLimit() {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth - 420));
}

function currentSidebarWidth() {
  const width = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'));
  return Number.isFinite(width) ? width : 300;
}

function applySidebarWidth(width, persist = true) {
  const nextWidth = Math.round(Math.min(sidebarWidthLimit(), Math.max(SIDEBAR_MIN_WIDTH, width)));
  document.documentElement.style.setProperty('--sidebar-width', `${nextWidth}px`);
  ui.sidebarResizer.setAttribute('aria-valuemax', String(Math.round(sidebarWidthLimit())));
  ui.sidebarResizer.setAttribute('aria-valuenow', String(nextWidth));
  if (persist) {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(nextWidth));
    } catch {
      // 隐私模式下 localStorage 可能不可用，不影响拖拽本身。
    }
  }
}

function initializeSidebarResizer() {
  let savedWidth = null;
  try {
    const parsed = Number.parseFloat(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (Number.isFinite(parsed)) savedWidth = parsed;
  } catch {
    // 隐私模式下 localStorage 可能不可用，使用默认宽度。
  }
  if (savedWidth !== null) applySidebarWidth(savedWidth, false);
  else {
    ui.sidebarResizer.setAttribute('aria-valuemax', String(Math.round(sidebarWidthLimit())));
    ui.sidebarResizer.setAttribute('aria-valuenow', String(Math.round(currentSidebarWidth())));
  }

  let resizing = false;
  const stopResizing = () => {
    if (!resizing) return;
    resizing = false;
    document.body.classList.remove('sidebar-resizing');
  };
  ui.sidebarResizer.addEventListener('pointerdown', (event) => {
    if (window.innerWidth <= 700) return;
    event.preventDefault();
    resizing = true;
    document.body.classList.add('sidebar-resizing');
    ui.sidebarResizer.setPointerCapture?.(event.pointerId);
  });
  ui.sidebarResizer.addEventListener('pointermove', (event) => {
    if (resizing) applySidebarWidth(event.clientX);
  });
  ui.sidebarResizer.addEventListener('pointerup', stopResizing);
  ui.sidebarResizer.addEventListener('pointercancel', stopResizing);
  ui.sidebarResizer.addEventListener('lostpointercapture', stopResizing);
  ui.sidebarResizer.addEventListener('keydown', (event) => {
    const current = currentSidebarWidth();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      applySidebarWidth(current + (event.key === 'ArrowRight' ? 16 : -16));
    } else if (event.key === 'Home') {
      event.preventDefault();
      applySidebarWidth(SIDEBAR_MIN_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      applySidebarWidth(sidebarWidthLimit());
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) applySidebarWidth(currentSidebarWidth(), false);
  });
}

function setSidebarCollapsed(collapsed, persist = true) {
  const isCollapsed = Boolean(collapsed);
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  ui.sidebarToggle.setAttribute('aria-expanded', String(!isCollapsed));
  ui.sidebarToggle.setAttribute('aria-label', isCollapsed ? t('expandTree') : t('collapseTree'));
  if (persist) {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch {
      // 隐私模式下 localStorage 可能不可用，不影响收起功能。
    }
  }
}

function initializeSidebarCollapse() {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    // 隐私模式下 localStorage 可能不可用，使用展开状态。
  }
  setSidebarCollapsed(collapsed, false);
  ui.sidebarToggle.addEventListener('click', () => setSidebarCollapsed(true));
  ui.sidebarExpandButton.addEventListener('click', () => setSidebarCollapsed(false));
}

function setSidebarMenuOpen(open) {
  const isOpen = Boolean(open);
  ui.sidebarMenu.classList.toggle('hidden', !isOpen);
  ui.sidebarMoreButton.setAttribute('aria-expanded', String(isOpen));
}

function renderSidebarContext() {
  ui.sidebarCurrentTitle.textContent = t('brandName');
  ui.sidebarCurrentTitle.title = t('brandFull');
  ui.dashboardButton.title = t('returnDashboard');
}

function nowIso() {
  return new Date().toISOString();
}

function todayString(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function demoTime(daysAgo, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function demoDate(daysFromNow) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return todayString(date);
}

function formatTime(value) {
  if (!value) return t('notRecorded');
  return new Date(value).toLocaleString(currentLanguage() === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDate(value) {
  if (!value) return t('dateNotSet');
  return value.replaceAll('-', '/');
}

function fileExtension(name) {
  const index = name.lastIndexOf('.');
  return index >= 0 ? name.slice(index + 1).toLowerCase() : '';
}

function fileType(name) {
  const extension = fileExtension(name);
  if (FILE_TYPES.markdown.has(extension)) return 'markdown';
  if (FILE_TYPES.notebook.has(extension)) return 'notebook';
  if (FILE_TYPES.code.has(extension)) return 'code';
  if (FILE_TYPES.text.has(extension)) return 'text';
  if (FILE_TYPES.image.has(extension)) return 'image';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  return 'unsupported';
}

function makeId(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function showToast(message, isError = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle('error', isError);
  ui.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove('show'), 2800);
}

function dismissStarPrompt() {
  ui.starPrompt.classList.add('hidden');
}

function maybeShowStarPrompt() {
  if (state.mode !== 'local' && state.mode !== 'demo') return;
  ui.starPrompt.classList.remove('hidden');
}

async function requestVscodeBridge(endpoint, options = {}, timeoutMs = VSCODE_BRIDGE_TIMEOUT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${VSCODE_BRIDGE_URL}${endpoint}`, {...options, signal: controller.signal});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403) {
        // 桥接服务在跑，但没放行当前站点：交给上层回退到浏览器目录选择。
        const forbidden = new Error(t('vscodeBridgeForbidden', {origin: window.location.origin}));
        forbidden.code = 'bridge-forbidden';
        throw forbidden;
      }
      const error = new Error(payload.error || t('vscodeRequestFailed', {status: response.status}));
      error.code = payload.error === '已取消目录选择' || payload.error === t('cancelledRoot') ? 'cancelled' : 'bridge-request-failed';
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) {
      const unavailable = new Error(t('vscodeAssistantUnavailable'));
      unavailable.code = 'bridge-unavailable';
      throw unavailable;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function openSelectedFileInVscode() {
  if (state.mode !== 'local' || state.localSource !== 'bridge' || !state.selectedPath) return;
  try {
    const health = await requestVscodeBridge('/api/health');
    if (health.rootName && health.rootName !== state.rootName) {
      throw new Error(t('vscodeBindingMismatch', {bound: health.rootName, current: state.rootName}));
    }
    await requestVscodeBridge('/api/open', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({path: state.selectedPath}),
    });
    showToast(t('openVscodeSuccess'));
  } catch (error) {
    showToast(error.message || t('openVscodeFailed'), true);
  }
}

function normalizeWorkspace(raw) {
  const workspace = createWorkspaceState();
  if (!raw || typeof raw !== 'object') return workspace;
  workspace.version = Number(raw.version) || 1;
  workspace.updatedAt = raw.updatedAt || null;
  for (const [path, value] of Object.entries(raw.files || {})) {
    if (!value || typeof value !== 'object') continue;
    workspace.files[path] = {
      learningStatus: LEARNING_LABELS[value.learningStatus] ? value.learningStatus : 'unlearned',
      note: typeof value.note === 'string' ? value.note : '',
      nextReviewAt: value.nextReviewAt || null,
      sessions: Array.isArray(value.sessions) ? value.sessions.map((session) => ({
        id: session.id || makeId('session'),
        at: session.at || nowIso(),
        learningStatus: LEARNING_LABELS[session.learningStatus || session.status] ? (session.learningStatus || session.status) : 'unlearned',
        note: typeof session.note === 'string' ? session.note : '',
        nextReviewAt: session.nextReviewAt || null,
      })) : [],
    };
  }
  workspace.todos = Array.isArray(raw.todos) ? raw.todos.map((todo) => ({
    id: todo.id || makeId('todo'),
    title: String(todo.title || '').slice(0, 300),
    todoDate: todo.todoDate || todayString(),
    completed: Boolean(todo.completed || todo.completedAt),
    completedAt: todo.completedAt || null,
  })).filter((todo) => todo.title) : [];
  return workspace;
}

function getLearning(path) {
  if (!state.workspace.files[path]) {
    state.workspace.files[path] = {
      learningStatus: 'unlearned',
      note: '',
      nextReviewAt: null,
      sessions: [],
    };
  }
  return state.workspace.files[path];
}

async function saveWorkspace() {
  if (state.mode !== 'local') return;
  state.workspace.updatedAt = nowIso();
  if (state.localSource === 'bridge') {
    await requestVscodeBridge('/api/workspace', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({workspace: state.workspace}),
    });
    return;
  }
  if (!state.rootHandle) return;
  const fileHandle = await state.rootHandle.getFileHandle(STATE_FILE, {create: true});
  const writable = await fileHandle.createWritable();
  await writable.write(`${JSON.stringify(state.workspace, null, 2)}\n`);
  await writable.close();
  if (state.legacyStateFile) {
    try {
      await state.rootHandle.removeEntry(LEGACY_STATE_FILE);
      state.legacyStateFile = false;
    } catch (error) {
      if (error.name === 'NotFoundError') state.legacyStateFile = false;
    }
  }
}

async function readWorkspace(rootHandle) {
  for (const fileName of STATE_FILES) {
    try {
      const fileHandle = await rootHandle.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return {
        workspace: normalizeWorkspace(JSON.parse(await file.text())),
        fromLegacy: fileName === LEGACY_STATE_FILE,
      };
    } catch (error) {
      if (error.name === 'NotFoundError') continue;
      if (error instanceof SyntaxError) throw new Error(t('workspaceCorrupt'));
      throw error;
    }
  }
  return {workspace: createWorkspaceState(), fromLegacy: false};
}

async function readBridgeWorkspace() {
  const payload = await requestVscodeBridge('/api/workspace');
  return normalizeWorkspace(payload.workspace);
}

function insertTreePath(root, path, entry) {
  const parts = path.split('/');
  let parent = root;
  let currentPath = '';
  parts.forEach((part, index) => {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    let child = parent.children.find((item) => item.name === part);
    if (!child) {
      child = index === parts.length - 1 ? entry : {kind: 'directory', name: part, path: currentPath, children: []};
      parent.children.push(child);
    }
    parent = child;
  });
}

function sortTree(node) {
  node.children.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
    return left.name.localeCompare(right.name, 'zh-CN', {numeric: true, sensitivity: 'base'});
  });
  node.children.filter((child) => child.kind === 'directory').forEach(sortTree);
}

async function scanDirectory(handle, path = '') {
  const root = {kind: 'directory', name: handle.name, path, children: []};
  for await (const [name, childHandle] of handle.entries()) {
    if (STATE_FILES.includes(name) || name.startsWith('.')) continue;
    if (childHandle.kind === 'directory' && IGNORED_DIRECTORIES.has(name)) continue;
    const childPath = path ? `${path}/${name}` : name;
    if (childHandle.kind === 'directory') {
      root.children.push(await scanDirectory(childHandle, childPath));
    } else {
      root.children.push({kind: 'file', name, path: childPath, handle: childHandle, type: fileType(name)});
    }
  }
  sortTree(root);
  return root;
}

function buildDemoTree(manifest) {
  const root = {kind: 'directory', name: manifest.name, path: '', children: []};
  for (const file of manifest.files) {
    const entry = {
      kind: 'file',
      name: file.name,
      path: file.path,
      type: fileType(file.name),
      url: `${import.meta.env.BASE_URL}demo/${file.path}`,
    };
    insertTreePath(root, file.path, entry);
  }
  sortTree(root);
  return root;
}

function buildBridgeTree(payload) {
  const root = {kind: 'directory', name: payload.rootName || state.rootName, path: '', children: []};
  for (const file of payload.files || []) {
    if (!file || typeof file.path !== 'string' || !file.path) continue;
    const name = file.name || file.path.split('/').pop();
    insertTreePath(root, file.path, {
      kind: 'file',
      name,
      path: file.path,
      type: fileType(name),
      bridge: true,
    });
  }
  sortTree(root);
  return root;
}

function flattenFiles(node, files = []) {
  for (const child of node.children) {
    if (child.kind === 'file') files.push(child);
    else flattenFiles(child, files);
  }
  return files;
}

function setWorkspace(root, mode) {
  state.mode = mode;
  state.tree = root;
  state.fileByPath = new Map(flattenFiles(root).map((file) => [file.path, file]));
  state.expanded = new Set(['']);
  state.selectedPath = null;
  state.selectedFile = null;
  state.draft = null;
  renderTree();
  showDashboard();
}

async function openFolderWithBridge() {
  const result = await requestVscodeBridge(
    '/api/select-root',
    {method: 'POST'},
    VSCODE_ROOT_SELECT_TIMEOUT,
  );
  const [treePayload, workspace] = await Promise.all([
    requestVscodeBridge('/api/tree'),
    readBridgeWorkspace(),
  ]);
  state.localSource = 'bridge';
  state.rootHandle = null;
  state.legacyStateFile = false;
  state.rootName = result.rootName;
  state.workspace = workspace;
  setWorkspace(buildBridgeTree(treePayload), 'local');
  showToast(t('openAssociated', {root: result.rootName}));
  maybeShowStarPrompt();
}

async function openFolderWithBrowser() {
  if (!window.showDirectoryPicker) {
    throw new Error(t('browserFolderUnsupported'));
  }
  const handle = await window.showDirectoryPicker({mode: 'readwrite'});
  state.localSource = 'browser';
  state.rootHandle = handle;
  state.rootName = handle.name;
  const loadedWorkspace = await readWorkspace(handle);
  state.workspace = loadedWorkspace.workspace;
  state.legacyStateFile = loadedWorkspace.fromLegacy;
  setWorkspace(await scanDirectory(handle), 'local');
  showToast(t('openLocalSuccess', {root: handle.name}));
  maybeShowStarPrompt();
}

async function openLocalFolder() {
  try {
    await openFolderWithBridge();
  } catch (error) {
    if (error.code === 'cancelled' || error.name === 'AbortError') return;
    if (error.code !== 'bridge-unavailable' && error.code !== 'bridge-forbidden') {
      showToast(error.message || t('openFolderFailed'), true);
      return;
    }
    // 桥接未启动时静默回退；未放行当前站点时回退并给出可执行的放行命令。
    const fallbackMessage = error.code === 'bridge-forbidden' ? (error.message || '') : '';
    try {
      await openFolderWithBrowser();
      if (fallbackMessage) showToast(fallbackMessage, true);
    } catch (fallbackError) {
      if (fallbackError.name !== 'AbortError') showToast(fallbackError.message || t('openFolderFailed'), true);
    }
  }
}

async function openDemo() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}demo/manifest.json`);
    if (!response.ok) throw new Error(t('demoFileLoadFailed'));
    const manifest = await response.json();
    state.rootHandle = null;
    state.localSource = null;
    state.legacyStateFile = false;
    state.rootName = manifest.name;
    state.workspace = normalizeWorkspace({
      todos: [
        {id: 'demo-todo-lru', title: '手写一次 LRU 缓存', todoDate: todayString(), completed: false},
        {id: 'demo-todo-array', title: '复习数组双指针题', todoDate: demoDate(1), completed: false},
        {id: 'demo-todo-note', title: '整理今天的学习笔记', todoDate: todayString(), completed: false},
        {id: 'demo-todo-done', title: '标记三道数组题的学习状态', todoDate: todayString(), completed: true, completedAt: demoTime(0, 8, 40)},
      ],
      files: {
        'notes/welcome.md': {
          learningStatus: 'understood',
          note: '熟悉工作台的文件树、学习管理和沉浸式阅读流程。',
          sessions: [
            {id: 'demo-session-welcome-1', at: demoTime(3, 20, 10), learningStatus: 'learning', note: '熟悉工作台的基本功能'},
            {id: 'demo-session-welcome-2', at: demoTime(2, 20, 40), learningStatus: 'understood', note: '完成示例流程，知道打开文件不会自动记为学习'},
          ],
        },
        'notes/study-plan.md': {
          learningStatus: 'learning',
          note: '按数组基础、链表缓存、复习三个阶段推进。',
          sessions: [{id: 'demo-session-plan', at: demoTime(1, 19, 30), learningStatus: 'learning', note: '确定本周学习顺序'}],
        },
        'leetcode/146-lru-cache.md': {
          learningStatus: 'learning',
          note: '先理解哈希表和双向链表的配合。',
          sessions: [
            {id: 'demo-session-lru-1', at: demoTime(2, 18, 30), learningStatus: 'learning', note: '先理解哈希表和双向链表的配合'},
            {id: 'demo-session-lru-2', at: demoTime(0, 19, 20), learningStatus: 'learning', note: '完成示例学习记录'},
          ],
        },
        'leetcode/27-remove-element.md': {
          learningStatus: 'understood',
          note: '快慢指针让有效元素覆盖到数组前部，不需要额外数组。',
          sessions: [{id: 'demo-session-27', at: demoTime(4, 18, 45), learningStatus: 'understood', note: '手写快慢指针，并验证原地修改要求'}],
        },
        'leetcode/283-move-zeroes.md': {
          learningStatus: 'review',
          note: '交换逻辑已经写出，需要复习如何减少不必要的交换。',
          nextReviewAt: demoDate(3),
          sessions: [{id: 'demo-session-283', at: demoTime(1, 20, 5), learningStatus: 'review', note: '交换逻辑已经写出，安排下一次复习', nextReviewAt: demoDate(3)}],
        },
        'leetcode/485-max-consecutive-ones.md': {
          learningStatus: 'mastered',
          note: '用当前连续长度和历史最大值一次遍历解决。',
          sessions: [
            {id: 'demo-session-485-1', at: demoTime(5, 17, 50), learningStatus: 'understood', note: '记录连续长度的状态转移'},
            {id: 'demo-session-485-2', at: demoTime(3, 19, 10), learningStatus: 'mastered', note: '独立写出一次遍历解法'},
          ],
        },
        'examples/lru-cache.js': {
          learningStatus: 'learning',
          note: '准备把 LRU 的核心操作补成可运行代码。',
          sessions: [{id: 'demo-session-code', at: demoTime(0, 21, 0), learningStatus: 'learning', note: '开始补写带哨兵节点的代码'}],
        },
      },
    });
    setWorkspace(buildDemoTree(manifest), 'demo');
    showToast(t('demoEntered'));
    maybeShowStarPrompt();
  } catch (error) {
    showToast(error.message || t('demoFileLoadFailed'), true);
  }
}

function currentQuery() {
  return state.search.trim().toLowerCase();
}

function matchesFile(file) {
  const query = currentQuery();
  return !query || `${file.name} ${file.path}`.toLowerCase().includes(query);
}

function hasVisibleChildren(node) {
  return node.children.some((child) => child.kind === 'file' ? matchesFile(child) : hasVisibleChildren(child));
}

function renderTreeRow(node) {
  const row = document.createElement('div');
  row.className = `tree-row ${node.kind === 'directory' ? 'directory-row' : 'file-row'}`;
  if (node.path === state.selectedPath) row.classList.add('selected');

  const arrow = document.createElement('span');
  arrow.className = `tree-arrow ${node.kind === 'directory' ? 'has-children' : ''} ${state.expanded.has(node.path) ? 'open' : ''}`;
  arrow.textContent = node.kind === 'directory' ? '›' : '';
  row.appendChild(arrow);

  const icon = document.createElement('span');
  icon.className = `tree-icon ${node.kind === 'directory' ? 'folder' : 'file'}`;
  row.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = node.name;
  label.title = node.path || node.name;
  row.appendChild(label);

  if (node.kind === 'file') {
    const learning = state.workspace.files[node.path];
    if (learning?.learningStatus && learning.learningStatus !== 'unlearned') {
      const status = document.createElement('span');
      status.className = `tree-status ${learning.learningStatus}`;
      status.textContent = learningLabel(learning.learningStatus);
      status.title = learningLabel(learning.learningStatus);
      row.appendChild(status);
    }
    row.addEventListener('click', () => selectFile(node.path));
  } else {
    row.addEventListener('click', () => {
      if (state.expanded.has(node.path)) state.expanded.delete(node.path);
      else state.expanded.add(node.path);
      renderTree();
    });
  }
  return row;
}

function renderDirectory(node, parent) {
  if (node.path && currentQuery() && !hasVisibleChildren(node)) return;
  if (node.path && !currentQuery() && !hasVisibleChildren(node) && node.children.length === 0) return;
  parent.appendChild(renderTreeRow(node));
  const shouldExpand = state.expanded.has(node.path) || Boolean(currentQuery());
  if (!shouldExpand) return;
  const childContainer = document.createElement('div');
  childContainer.className = 'tree-children';
  for (const child of node.children) {
    if (child.kind === 'directory') {
      renderDirectory(child, childContainer);
    } else if (matchesFile(child)) {
      childContainer.appendChild(renderTreeRow(child));
    }
  }
  parent.appendChild(childContainer);
}

function renderTree() {
  const hasTree = Boolean(state.tree);
  document.body.classList.toggle('library-empty', !hasTree);
  ui.sidebarRootName.textContent = hasTree ? state.rootName : t('noFolderSelected');
  ui.sidebarRootName.title = hasTree ? state.rootName : t('noLibraryTitle');
  ui.sidebarRootFooter.title = hasTree ? t('currentLibraryTitle', {root: state.rootName}) : t('noLibraryTitle');
  ui.sidebarRootActionIcon.textContent = hasTree ? '↻' : '＋';
  ui.sidebarRootActionLabel.textContent = hasTree ? t('rootActionChange') : t('rootActionOpen');
  ui.openFolderButton.title = hasTree ? t('rootActionChange') : t('rootActionOpen');
  ui.tree.replaceChildren();
  if (!hasTree) {
    ui.tree.appendChild(ui.treeEmptyState);
    return;
  }
  if (currentQuery() && !hasVisibleChildren(state.tree)) {
    ui.tree.innerHTML = `<div class="tree-placeholder">${t('noMatchingFiles')}</div>`;
    return;
  }
  for (const child of state.tree.children) {
    if (child.kind === 'directory') {
      renderDirectory(child, ui.tree);
    } else if (matchesFile(child)) {
      ui.tree.appendChild(renderTreeRow(child));
    }
  }
}

function visibleTodos() {
  const today = todayString();
  return state.workspace.todos
    .filter((todo) => !todo.completed || (todo.completedAt && todo.completedAt.startsWith(today)))
    .sort((left, right) => {
      if (left.completed !== right.completed) return left.completed ? 1 : -1;
      return `${left.todoDate || ''}-${right.id}`.localeCompare(`${right.todoDate || ''}-${left.id}`);
    });
}

function renderTodoList() {
  const todos = visibleTodos();
  const remaining = todos.filter((todo) => !todo.completed).length;
  ui.todoSummary.textContent = state.mode === 'empty' ? t('noLibrary') : (todos.length ? t('todoRemaining', {count: remaining}) : t('noTodayTodos'));
  ui.todoList.innerHTML = '';
  if (!todos.length) {
    ui.todoList.innerHTML = `<div class="empty-box">${t('emptyTodayTodos')}</div>`;
    return;
  }
  for (const todo of todos) {
    const item = document.createElement('div');
    item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    const toggle = document.createElement('button');
    toggle.className = 'todo-toggle';
    toggle.type = 'button';
    toggle.textContent = todo.completed ? '✓' : '';
    toggle.title = todo.completed ? t('markIncomplete') : t('markComplete');
    toggle.addEventListener('click', () => toggleTodo(todo.id));
    const body = document.createElement('div');
    body.className = 'todo-body';
    const title = document.createElement('span');
    title.className = 'todo-title';
    title.textContent = todo.title;
    const date = document.createElement('span');
    date.className = 'todo-date';
    date.textContent = t('todoPlanDate', {date: formatDate(todo.todoDate)});
    body.append(title, date);
    const remove = document.createElement('button');
    remove.className = 'quiet-delete';
    remove.type = 'button';
    remove.textContent = t('delete');
    remove.addEventListener('click', () => deleteTodo(todo.id));
    item.append(toggle, body, remove);
    ui.todoList.appendChild(item);
  }
}

function allStudyRecords() {
  return Object.entries(state.workspace.files).flatMap(([path, fileState]) => {
    const entry = state.fileByPath.get(path);
    return (fileState.sessions || []).map((session) => ({
      ...session,
      path,
      name: entry?.name || path.split('/').pop(),
    }));
  }).sort((left, right) => new Date(right.at) - new Date(left.at));
}

function renderGlobalStudyList() {
  const records = allStudyRecords();
  ui.studySummary.textContent = records.length ? t('studyCount', {count: records.length}) : t('noStudyRecords');
  ui.globalStudyList.innerHTML = '';
  if (!records.length) {
    ui.globalStudyList.innerHTML = `<div class="empty-box">${t('studyRecordsHint')}</div>`;
    return;
  }
  for (const record of records) {
    const item = document.createElement('button');
    item.className = 'global-study-item';
    item.type = 'button';
    item.addEventListener('click', () => selectFile(record.path));
    const main = document.createElement('span');
    main.className = 'global-study-main';
    const name = document.createElement('strong');
    name.textContent = record.name;
    const path = document.createElement('span');
    path.textContent = record.path;
    main.append(name, path);
    const meta = document.createElement('span');
    meta.className = 'global-study-meta';
    const time = document.createElement('span');
    time.textContent = formatTime(record.at);
    const status = document.createElement('span');
    const label = learningLabel(record.learningStatus);
    status.textContent = record.note ? `${label} · ${record.note}` : label;
    meta.append(time, status);
    item.append(main, meta);
    ui.globalStudyList.appendChild(item);
  }
}

function revealTreePath(path) {
  state.expanded.add('');
  let currentPath = '';
  for (const part of path.split('/').slice(0, -1)) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    state.expanded.add(currentPath);
  }
}

function openOverviewFile(path) {
  if (!path || !state.fileByPath.has(path)) return;
  closeOverviewModal();
  revealTreePath(path);
  selectFile(path);
}

function setOverviewTarget(button, path, activeTitle, disabledTitle) {
  button.dataset.path = path || '';
  button.disabled = !path;
  button.title = t(path ? activeTitle : disabledTitle);
}

function setOverviewListTarget(button, enabled, activeTitle) {
  button.disabled = !enabled;
  button.title = t(enabled ? activeTitle : 'pleaseOpenLibrary');
}

function latestSession(fileState) {
  return [...(fileState?.sessions || [])].sort((left, right) => (Date.parse(right.at) || 0) - (Date.parse(left.at) || 0))[0] || null;
}

function overviewFiles(kind) {
  const isReview = kind === 'review';
  const files = [...state.fileByPath.values()]
    .map((entry) => ({entry, learning: state.workspace.files[entry.path]}))
    .filter(({learning}) => isReview
      ? learning?.learningStatus === 'review'
      : Boolean(learning?.learningStatus && learning.learningStatus !== 'unlearned'));

  return files.sort((left, right) => {
    if (isReview) {
      const leftReview = left.learning.nextReviewAt ? (Date.parse(left.learning.nextReviewAt) || Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      const rightReview = right.learning.nextReviewAt ? (Date.parse(right.learning.nextReviewAt) || Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      if (leftReview !== rightReview) return leftReview - rightReview;
    }
    const leftLatest = Date.parse(latestSession(left.learning)?.at || '') || 0;
    const rightLatest = Date.parse(latestSession(right.learning)?.at || '') || 0;
    return rightLatest - leftLatest || left.entry.path.localeCompare(right.entry.path, 'zh-CN', {numeric: true, sensitivity: 'base'});
  });
}

function renderOverviewModalList(kind) {
  const isReview = kind === 'review';
  const files = overviewFiles(kind);
  ui.overviewModal.dataset.kind = isReview ? 'review' : 'studied';
  ui.overviewModalTitle.textContent = t(isReview ? 'overviewReviewModalTitle' : 'overviewProgressModalTitle');
  ui.overviewModalHint.textContent = t(isReview ? 'overviewReviewModalHint' : 'overviewProgressModalHint', {count: files.length});
  ui.overviewModalList.replaceChildren();

  if (!files.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-box overview-modal-empty';
    empty.textContent = t(isReview ? 'overviewReviewModalEmpty' : 'overviewProgressModalEmpty');
    ui.overviewModalList.appendChild(empty);
    return;
  }

  for (const {entry, learning} of files) {
    const item = document.createElement('button');
    item.className = 'overview-list-item';
    item.type = 'button';
    item.title = `${t('overviewFileOpen')}: ${entry.path}`;
    item.addEventListener('click', () => openOverviewFile(entry.path));

    const main = document.createElement('span');
    main.className = 'overview-list-main';
    const name = document.createElement('strong');
    name.className = 'overview-list-name';
    name.textContent = entry.name;
    const path = document.createElement('span');
    path.className = 'overview-list-path';
    path.textContent = entry.path;
    main.append(name, path);

    const meta = document.createElement('span');
    meta.className = 'overview-list-meta';
    const status = document.createElement('span');
    status.className = 'overview-list-status';
    status.textContent = learningLabel(learning.learningStatus);
    const sessions = document.createElement('span');
    sessions.className = 'overview-list-submeta';
    sessions.textContent = t('overviewStudySessions', {count: learning.sessions?.length || 0});
    meta.append(status, sessions);

    const latest = latestSession(learning);
    if (isReview && learning.nextReviewAt) {
      const nextReview = document.createElement('span');
      nextReview.className = 'overview-list-submeta';
      nextReview.textContent = t('overviewNextReview', {date: formatDate(learning.nextReviewAt)});
      meta.appendChild(nextReview);
    }
    if (latest) {
      const lastStudy = document.createElement('span');
      lastStudy.className = 'overview-list-submeta';
      lastStudy.textContent = t('overviewLastStudy', {time: formatTime(latest.at)});
      meta.appendChild(lastStudy);
    }

    item.append(main, meta);
    ui.overviewModalList.appendChild(item);
  }
}

function openOverviewModal(kind) {
  if (!state.tree) return;
  renderOverviewModalList(kind);
  ui.overviewModal.classList.remove('hidden');
  requestAnimationFrame(() => ui.closeOverviewModalButton.focus());
}

function closeOverviewModal() {
  ui.overviewModal.classList.add('hidden');
}

function renderDashboardOverview() {
  const hasTree = Boolean(state.tree);
  ui.dashboardOverview.classList.toggle('hidden', !hasTree);
  setOverviewListTarget(ui.overviewProgressButton, hasTree, 'overviewProgressAction');
  setOverviewListTarget(ui.overviewReviewButton, hasTree, 'overviewReviewAction');
  if (!hasTree) {
    setOverviewTarget(ui.overviewRecentButton, null, 'overviewRecentAction', 'overviewRecentDisabled');
    return;
  }

  const total = state.fileByPath.size;
  const studied = Object.values(state.workspace.files).filter((file) => file.learningStatus && file.learningStatus !== 'unlearned').length;
  const progress = total ? Math.round((studied / total) * 100) : 0;
  ui.overviewProgressValue.textContent = `${progress}%`;
  ui.overviewProgressMeta.textContent = t('overviewProgressMeta', {studied, total});

  const recent = allStudyRecords()[0];
  ui.overviewRecentValue.textContent = recent?.name || '—';
  ui.overviewRecentMeta.textContent = recent
    ? t('overviewRecentMeta', {path: recent.path, time: formatTime(recent.at)})
    : t('overviewRecentEmpty');
  const recentTarget = recent && state.fileByPath.has(recent.path) ? recent.path : null;
  setOverviewTarget(ui.overviewRecentButton, recentTarget, 'overviewRecentAction', 'overviewRecentDisabled');

  const reviewCount = Object.values(state.workspace.files).filter((file) => file.learningStatus === 'review').length;
  ui.overviewReviewValue.textContent = String(reviewCount);
  ui.overviewReviewMeta.textContent = t('overviewReviewFiles');
}

function renderDashboard() {
  renderSidebarContext();
  ui.dashboardView.classList.remove('hidden');
  ui.fileView.classList.add('hidden');
  updateVscodeButton();
  renderDashboardOverview();
  renderTodoList();
  renderGlobalStudyList();
}

function updateVscodeButton() {
  const {visible, enabled, title} = getVscodeButtonState({
    localSource: state.localSource,
    hasSelectedFile: Boolean(state.selectedPath && !ui.fileView.classList.contains('hidden')),
    unavailableTitle: t('vscodeButtonUnavailable'),
  });
  ui.openVscodeTooltip.classList.toggle('hidden', !visible);
  ui.openVscodeButton.disabled = !enabled;
  ui.openVscodeButton.setAttribute('aria-disabled', String(!enabled));
  ui.openVscodeButton.title = '';
  ui.openVscodeTooltipText.textContent = title;
}

function setImmersiveMode(enabled) {
  state.immersive = Boolean(enabled && state.selectedPath);
  document.body.classList.toggle('immersive-mode', state.immersive);
}

function openLearningModal() {
  if (!state.selectedPath) return;
  renderLearningPanel();
  ui.learningModal.classList.remove('hidden');
  requestAnimationFrame(() => ui.statusButtons.querySelector('.active')?.focus());
}

function closeLearningModal() {
  ui.learningModal.classList.add('hidden');
}

function showDashboard() {
  state.selectedPath = null;
  state.selectedFile = null;
  setImmersiveMode(false);
  closeOverviewModal();
  closeLearningModal();
  cleanupReader();
  renderTree();
  renderDashboard();
}

function openTodoModal() {
  if (state.mode === 'empty') {
    showToast(t('pleaseOpenLibrary'), true);
    return;
  }
  ui.todoDate.value = todayString();
  ui.todoModal.classList.remove('hidden');
  requestAnimationFrame(() => ui.todoInput.focus());
}

function closeTodoModal() {
  ui.todoModal.classList.add('hidden');
  ui.todoInput.value = '';
  ui.todoDate.value = todayString();
}

async function addTodo(event) {
  event.preventDefault();
  const title = ui.todoInput.value.trim();
  if (!title) {
    ui.todoInput.focus();
    return;
  }
  state.workspace.todos.unshift({id: makeId('todo'), title, todoDate: ui.todoDate.value || todayString(), completed: false, completedAt: null});
  try {
    await saveWorkspace();
    closeTodoModal();
    renderDashboard();
    showToast(t('todoAdded'));
  } catch (error) {
    state.workspace.todos.shift();
    showToast(error.message || t('saveTodoFailed'), true);
  }
}

async function toggleTodo(id) {
  const todo = state.workspace.todos.find((item) => item.id === id);
  if (!todo) return;
  const previousCompleted = todo.completed;
  const previousCompletedAt = todo.completedAt;
  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? nowIso() : null;
  try {
    await saveWorkspace();
    renderDashboard();
  } catch (error) {
    todo.completed = previousCompleted;
    todo.completedAt = previousCompletedAt;
    showToast(error.message || t('saveTodoFailed'), true);
  }
}

async function deleteTodo(id) {
  if (!window.confirm(t('deleteTodoConfirm'))) return;
  const index = state.workspace.todos.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [removed] = state.workspace.todos.splice(index, 1);
  try {
    await saveWorkspace();
    renderDashboard();
  } catch (error) {
    state.workspace.todos.splice(index, 0, removed);
    showToast(error.message || t('deleteTodoFailed'), true);
  }
}

function syncReviewDate() {
  const isReview = state.draft?.learningStatus === 'review';
  ui.reviewRow.classList.toggle('hidden', !isReview);
  if (isReview && !ui.reviewDate.value) {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    ui.reviewDate.value = todayString(date);
  }
}

function renderStatusButtons() {
  ui.statusButtons.innerHTML = '';
  for (const [value] of Object.entries(LEARNING_LABELS)) {
    const button = document.createElement('button');
    button.className = `status-button ${state.draft?.learningStatus === value ? 'active' : ''}`;
    button.type = 'button';
    button.textContent = learningLabel(value);
    button.addEventListener('click', () => {
      state.draft.learningStatus = value;
      renderStatusButtons();
      syncReviewDate();
    });
    ui.statusButtons.appendChild(button);
  }
  syncReviewDate();
}

function renderFileHistory() {
  const learning = getLearning(state.selectedPath);
  const sessions = learning.sessions || [];
  ui.fileStudySummary.textContent = t('fileStudyCount', {count: sessions.length});
  ui.fileStudyList.innerHTML = '';
  if (!sessions.length) {
    ui.fileStudyList.innerHTML = `<div class="empty-box">${t('noFileStudy')}</div>`;
    return;
  }
  for (const session of sessions) {
    const item = document.createElement('div');
    item.className = 'study-item';
    const time = document.createElement('span');
    time.className = 'study-time';
    time.textContent = formatTime(session.at);
    const content = document.createElement('span');
    content.className = 'study-label';
    const label = learningLabel(session.learningStatus);
    content.textContent = session.note ? `${label} · ${session.note}` : label;
    const remove = document.createElement('button');
    remove.className = 'quiet-delete';
    remove.type = 'button';
    remove.textContent = t('delete');
    remove.addEventListener('click', () => deleteStudySession(session.id));
    item.append(time, content, remove);
    ui.fileStudyList.appendChild(item);
  }
}

function renderLearningPanel() {
  const learning = getLearning(state.selectedPath);
  state.draft = {
    learningStatus: learning.learningStatus,
    note: learning.note || '',
    nextReviewAt: learning.nextReviewAt || '',
  };
  ui.noteInput.value = state.draft.note;
  ui.reviewDate.value = state.draft.nextReviewAt;
  renderStatusButtons();
  renderFileHistory();
}

async function recordStudy() {
  if (!state.selectedPath || !state.draft) return;
  const learning = getLearning(state.selectedPath);
  const session = {
    id: makeId('session'),
    at: nowIso(),
    learningStatus: state.draft.learningStatus,
    note: ui.noteInput.value.trim().slice(0, 4000),
    nextReviewAt: state.draft.learningStatus === 'review' ? ui.reviewDate.value || null : null,
  };
  const previousLearning = {
    learningStatus: learning.learningStatus,
    note: learning.note,
    nextReviewAt: learning.nextReviewAt,
    sessions: learning.sessions,
  };
  learning.learningStatus = state.draft.learningStatus;
  learning.note = session.note;
  learning.nextReviewAt = session.nextReviewAt;
  learning.sessions = [session, ...(learning.sessions || [])];
  try {
    await saveWorkspace();
    state.draft.note = session.note;
    state.draft.nextReviewAt = learning.nextReviewAt || '';
    renderTree();
    renderLearningPanel();
    renderGlobalStudyList();
    showToast(t('recordedStudy'));
  } catch (error) {
    learning.learningStatus = previousLearning.learningStatus;
    learning.note = previousLearning.note;
    learning.nextReviewAt = previousLearning.nextReviewAt;
    learning.sessions = previousLearning.sessions;
    showToast(error.message || t('saveStudyFailed'), true);
  }
}

async function deleteStudySession(id) {
  if (!state.selectedPath) return;
  if (!window.confirm(t('deleteStudyConfirm'))) return;
  const learning = getLearning(state.selectedPath);
  const index = learning.sessions.findIndex((session) => session.id === id);
  if (index < 0) return;
  const previousLearning = {
    learningStatus: learning.learningStatus,
    note: learning.note,
    nextReviewAt: learning.nextReviewAt,
    sessions: learning.sessions,
  };
  const [removed] = learning.sessions.splice(index, 1);
  const latest = learning.sessions[0];
  if (latest) {
    learning.learningStatus = latest.learningStatus;
    learning.note = latest.note;
    learning.nextReviewAt = latest.learningStatus === 'review' ? latest.nextReviewAt || null : null;
  } else {
    learning.learningStatus = 'unlearned';
    learning.note = '';
    learning.nextReviewAt = null;
  }
  try {
    await saveWorkspace();
    renderTree();
    renderLearningPanel();
    renderGlobalStudyList();
    showToast(t('deletedStudy'));
  } catch (error) {
    learning.learningStatus = previousLearning.learningStatus;
    learning.note = previousLearning.note;
    learning.nextReviewAt = previousLearning.nextReviewAt;
    learning.sessions = previousLearning.sessions;
    showToast(error.message || t('deleteStudyFailed'), true);
  }
}

function cleanupReader() {
  state.readerToken += 1;
  state.pdf = null;
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  state.notebookObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.notebookObjectUrls = [];
}

async function readEntry(entry) {
  if (state.mode === 'demo') {
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(t('demoReadFailed'));
    return new File([await response.blob()], entry.name, {type: response.headers.get('content-type') || ''});
  }
  if (state.localSource === 'bridge') {
    const response = await fetch(`${VSCODE_BRIDGE_URL}/api/file?path=${encodeURIComponent(entry.path)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || t('localFileReadFailed'));
    }
    return new File([await response.blob()], entry.name, {type: response.headers.get('content-type') || ''});
  }
  return entry.handle.getFile();
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[character]));
}

function codeLanguage(name) {
  const extension = fileExtension(name);
  return extension === 'js' || extension === 'jsx' ? 'javascript' : extension === 'ts' || extension === 'tsx' ? 'typescript' : extension === 'py' ? 'python' : extension === 'sh' ? 'bash' : extension;
}

function notebookSource(value) {
  if (Array.isArray(value)) return value.join('');
  return typeof value === 'string' ? value : '';
}

function notebookRelativePath(basePath, source) {
  let value;
  try {
    value = decodeURIComponent(String(source)).split(/[?#]/)[0].replaceAll('\\', '/');
  } catch {
    return null;
  }
  if (!value || value.startsWith('/') || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) return null;

  const parts = basePath.replaceAll('\\', '/').split('/').slice(0, -1);
  for (const part of value.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.length ? parts.join('/') : null;
}

function isNotebookRelativeImage(source) {
  return Boolean(source)
    && !source.startsWith('/')
    && !source.startsWith('//')
    && !/^(?:[a-z][a-z\d+.-]*:|#)/i.test(source);
}

function rememberNotebookObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  state.notebookObjectUrls.push(url);
  return url;
}

async function readBrowserAsset(relativePath) {
  if (!state.rootHandle) return null;
  const parts = relativePath.split('/');
  const fileName = parts.pop();
  let directory = state.rootHandle;
  for (const part of parts) directory = await directory.getDirectoryHandle(part);
  return directory.getFileHandle(fileName).then((handle) => handle.getFile());
}

async function readNotebookAsset(entry, source) {
  const relativePath = notebookRelativePath(entry.path, source);
  if (!relativePath) return null;
  try {
    let blob;
    if (state.mode === 'demo') {
      const response = await fetch(`${import.meta.env.BASE_URL}demo/${relativePath}`);
      if (!response.ok) return null;
      blob = await response.blob();
    } else if (state.localSource === 'bridge') {
      const response = await fetch(`${VSCODE_BRIDGE_URL}/api/file?path=${encodeURIComponent(relativePath)}`);
      if (!response.ok) return null;
      blob = await response.blob();
    } else {
      blob = await readBrowserAsset(relativePath);
    }
    return blob ? rememberNotebookObjectUrl(blob) : null;
  } catch {
    return null;
  }
}

function readNotebookAttachment(cell, source) {
  if (!source.toLowerCase().startsWith('attachment:')) return null;
  let name;
  try {
    name = decodeURIComponent(source.slice('attachment:'.length));
  } catch {
    return null;
  }
  const attachment = cell?.attachments?.[name];
  if (!attachment || typeof attachment !== 'object') return null;
  const imageMime = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].find((mime) => attachment[mime]);
  if (!imageMime) return null;
  const imageData = notebookSource(attachment[imageMime]).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageData)) return null;
  try {
    const bytes = Uint8Array.from(atob(imageData), (character) => character.charCodeAt(0));
    return rememberNotebookObjectUrl(new Blob([bytes], {type: imageMime}));
  } catch {
    return null;
  }
}

async function resolveNotebookImage(entry, cell, source) {
  const attachmentUrl = readNotebookAttachment(cell, source);
  if (attachmentUrl) return attachmentUrl;
  if (!isNotebookRelativeImage(source)) return null;
  return readNotebookAsset(entry, source);
}

async function renderNotebookMarkdown(source, entry, cell, token) {
  const container = document.createElement('div');
  container.innerHTML = marked.parse(source);
  const images = [...container.querySelectorAll('img')];
  const resolvedImages = [];
  await Promise.all(images.map(async (image) => {
    const sourceUrl = image.getAttribute('src') || '';
    if (!isNotebookRelativeImage(sourceUrl) && !sourceUrl.toLowerCase().startsWith('attachment:')) return;
    const imageUrl = await resolveNotebookImage(entry, cell, sourceUrl);
    if (token !== state.readerToken) {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      return;
    }
    if (imageUrl) {
      const placeholder = `https://cairn.invalid/notebook-image-${resolvedImages.length}`;
      resolvedImages.push({placeholder, imageUrl});
      image.setAttribute('src', placeholder);
      image.removeAttribute('srcset');
      return;
    }
    image.removeAttribute('src');
    image.classList.add('notebook-image-missing');
    image.alt = `${image.alt || t('notebookOutput')} · ${t('notebookImageUnavailable')}`;
  }));
  const safeContainer = document.createElement('div');
  safeContainer.innerHTML = DOMPurify.sanitize(container.innerHTML);
  for (const {placeholder, imageUrl} of resolvedImages) {
    const image = [...safeContainer.querySelectorAll('img')].find((candidate) => candidate.getAttribute('src') === placeholder);
    if (image) image.setAttribute('src', imageUrl);
  }
  return safeContainer.innerHTML;
}

function notebookLanguage(notebook, cell) {
  const language = cell?.metadata?.language
    || notebook?.metadata?.language_info?.name
    || notebook?.metadata?.kernelspec?.language
    || 'plaintext';
  const normalized = String(language).toLowerCase();
  if (normalized.includes('python')) return 'python';
  if (normalized.includes('javascript') || normalized === 'js') return 'javascript';
  if (normalized.includes('typescript') || normalized === 'ts') return 'typescript';
  if (normalized.includes('shell') || normalized === 'sh' || normalized === 'bash') return 'bash';
  if (normalized === 'c++') return 'cpp';
  return normalized;
}

async function highlightNotebookCode(source, language) {
  let html = escapeHtml(source);
  if (!language || language === 'plaintext' || language === 'text') return html;
  const hljs = await getHighlight();
  if (hljs.getLanguage(language)) html = hljs.highlight(source, {language}).value;
  return html;
}

function notebookOutputBody(output) {
  if (!output || typeof output !== 'object') return '';
  if (output.output_type === 'error') {
    const traceback = notebookSource(output.traceback) || [output.ename, output.evalue].filter(Boolean).join(': ');
    return traceback ? `<pre class="notebook-output-error">${escapeHtml(traceback)}</pre>` : '';
  }
  if (output.output_type === 'stream') {
    const text = notebookSource(output.text);
    return text ? `<pre class="notebook-output-text">${escapeHtml(text)}</pre>` : '';
  }

  const data = output.data;
  if (!data || typeof data !== 'object') return '';
  const imageMime = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].find((mime) => data[mime]);
  if (imageMime) {
    const imageData = notebookSource(data[imageMime]).replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(imageData)) {
      return `<img class="notebook-output-image" src="data:${imageMime};base64,${imageData}" alt="${escapeHtml(t('notebookOutput'))}" />`;
    }
  }

  const html = notebookSource(data['text/html']);
  if (html) return `<div class="notebook-output-html">${DOMPurify.sanitize(html)}</div>`;
  const markdown = notebookSource(data['text/markdown']);
  if (markdown) return `<div class="notebook-output-markdown markdown-reader">${DOMPurify.sanitize(marked.parse(markdown))}</div>`;
  const plainText = notebookSource(data['text/plain']);
  if (plainText) return `<pre class="notebook-output-text">${escapeHtml(plainText)}</pre>`;
  if (data['application/json'] !== undefined) {
    return `<pre class="notebook-output-text">${escapeHtml(JSON.stringify(data['application/json'], null, 2))}</pre>`;
  }
  return '';
}

function notebookOutput(output) {
  const body = notebookOutputBody(output);
  return body ? `<div class="notebook-output"><span class="notebook-output-label">${t('notebookOutput')}</span>${body}</div>` : '';
}

async function renderNotebook(file, entry, token) {
  let notebook;
  try {
    notebook = JSON.parse(await file.text());
  } catch {
    ui.readerContent.innerHTML = `<div class="unsupported-reader"><strong>${t('notebookInvalid')}</strong><span>${t('unsupportedHint')}</span></div>`;
    return;
  }

  if (!notebook || !Array.isArray(notebook.cells)) {
    ui.readerContent.innerHTML = `<div class="unsupported-reader"><strong>${t('notebookInvalid')}</strong><span>${t('unsupportedHint')}</span></div>`;
    return;
  }
  if (!notebook.cells.length) {
    ui.readerContent.innerHTML = `<div class="notebook-reader-empty">${t('notebookEmpty')}</div>`;
    return;
  }

  const cells = [];
  for (const cell of notebook.cells) {
    if (token !== state.readerToken) return;
    const type = cell?.cell_type;
    const source = notebookSource(cell?.source);
    if (type === 'markdown') {
      const markdown = await renderNotebookMarkdown(source, entry, cell, token);
      if (token !== state.readerToken) return;
      cells.push(`<section class="notebook-cell notebook-markdown-cell"><div class="notebook-cell-header"><span class="notebook-cell-type">${t('notebookMarkdown')}</span></div><div class="notebook-markdown markdown-reader">${markdown}</div></section>`);
      continue;
    }

    const code = await highlightNotebookCode(source, notebookLanguage(notebook, cell));
    if (token !== state.readerToken) return;
    const typeLabel = type === 'raw' ? t('notebookRaw') : t('notebookCode');
    const execution = type === 'code' && cell?.execution_count !== null && cell?.execution_count !== undefined
      ? `${t('notebookExecution')} ${cell.execution_count}`
      : '';
    const outputs = type === 'code' && Array.isArray(cell?.outputs) ? cell.outputs.map(notebookOutput).join('') : '';
    cells.push(`<section class="notebook-cell notebook-code-cell"><div class="notebook-cell-header"><span class="notebook-cell-type">${typeLabel}</span><span class="notebook-cell-count">${escapeHtml(execution)}</span></div><pre class="notebook-code code-reader"><code>${code}</code></pre>${outputs ? `<div class="notebook-outputs">${outputs}</div>` : ''}</section>`);
  }
  if (token !== state.readerToken) return;
  ui.readerContent.innerHTML = `<article class="notebook-reader" aria-label="${escapeHtml(t('notebookTitle'))}">${cells.join('')}</article>`;
}

async function renderPdf(file, token) {
  const pdfjsLib = await getPdfjs();
  const document = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
  if (token !== state.readerToken) return;
  state.pdf = {document, page: 1, scale: 1.2};
  ui.readerContent.innerHTML = `<div class="pdf-reader"><canvas id="pdfCanvas"></canvas><div class="pdf-toolbar" aria-label="${t('pdfControls')}"><button class="secondary-button" id="pdfPrevious" type="button">${t('previousPage')}</button><span id="pdfPageLabel"></span><button class="secondary-button" id="pdfNext" type="button">${t('nextPage')}</button></div></div>`;
  $('#pdfPrevious').addEventListener('click', () => changePdfPage(-1));
  $('#pdfNext').addEventListener('click', () => changePdfPage(1));
  await drawPdfPage(token);
}

async function drawPdfPage(token) {
  if (!state.pdf || token !== state.readerToken) return;
  const page = await state.pdf.document.getPage(state.pdf.page);
  if (token !== state.readerToken) return;
  const viewport = page.getViewport({scale: state.pdf.scale});
  const canvas = $('#pdfCanvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.maxWidth = '100%';
  await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
  $('#pdfPageLabel').textContent = `${state.pdf.page} / ${state.pdf.document.numPages}`;
  $('#pdfPrevious').disabled = state.pdf.page <= 1;
  $('#pdfNext').disabled = state.pdf.page >= state.pdf.document.numPages;
}

async function changePdfPage(delta) {
  if (!state.pdf) return;
  state.pdf.page = Math.min(Math.max(1, state.pdf.page + delta), state.pdf.document.numPages);
  await drawPdfPage(state.readerToken);
}

async function renderReader(file, entry, token) {
  const renderToken = token;
  const type = fileType(entry.name);
  ui.readerContent.innerHTML = `<div class="reader-placeholder">${t('loadingContent')}</div>`;

  if (type === 'pdf') {
    await renderPdf(file, renderToken);
    return;
  }
  if (type === 'image') {
    state.objectUrl = URL.createObjectURL(file);
    ui.readerContent.innerHTML = `<div class="image-reader"><img src="${state.objectUrl}" alt="${escapeHtml(entry.name)}" /></div>`;
    return;
  }
  if (type === 'docx') {
    const mammoth = await getMammoth();
    const result = await mammoth.convertToHtml({arrayBuffer: await file.arrayBuffer()});
    if (renderToken !== state.readerToken) return;
    ui.readerContent.innerHTML = DOMPurify.sanitize(`<div class="document-reader">${result.value}</div>`);
    return;
  }
  if (type === 'notebook') {
    await renderNotebook(file, entry, renderToken);
    return;
  }
  if (type === 'markdown') {
    const html = DOMPurify.sanitize(marked.parse(await file.text()));
    if (renderToken !== state.readerToken) return;
    ui.readerContent.innerHTML = `<div class="markdown-reader">${html}</div>`;
    return;
  }
  if (type === 'code' || type === 'text') {
    const text = await file.text();
    if (renderToken !== state.readerToken) return;
    let html = escapeHtml(text);
    const language = codeLanguage(entry.name);
    if (type === 'code') {
      const hljs = await getHighlight();
      if (renderToken !== state.readerToken) return;
      if (hljs.getLanguage(language)) html = hljs.highlight(text, {language}).value;
    }
    ui.readerContent.innerHTML = `<pre class="code-reader"><code>${html}</code></pre>`;
    return;
  }
  ui.readerContent.innerHTML = `<div class="unsupported-reader"><strong>${t('unsupportedPreview')}</strong><span>${t('unsupportedHint')}</span></div>`;
}

async function selectFile(path) {
  const entry = state.fileByPath.get(path);
  if (!entry) return;
  state.selectedPath = path;
  state.selectedFile = entry;
  closeOverviewModal();
  renderSidebarContext();
  setImmersiveMode(false);
  closeLearningModal();
  cleanupReader();
  ui.dashboardView.classList.add('hidden');
  ui.fileView.classList.remove('hidden');
  renderTree();
  const parentPath = entry.path.split('/').slice(0, -1).join('/');
  const displayPath = [state.rootName, parentPath].filter(Boolean).join(' / ');
  const fullPath = [state.rootName, entry.path].filter(Boolean).join(' / ');
  ui.readerFileName.textContent = entry.name;
  ui.readerFileName.title = entry.name;
  ui.readerPath.textContent = displayPath;
  ui.readerPath.title = fullPath;
  updateVscodeButton();
  ui.readerContent.innerHTML = `<div class="reader-placeholder">${t('readingFile')}</div>`;
  try {
    const file = await readEntry(entry);
    if (state.selectedPath !== path) return;
    renderLearningPanel();
    const readerToken = state.readerToken;
    await renderReader(file, entry, readerToken);
  } catch (error) {
    ui.readerContent.innerHTML = `<div class="unsupported-reader"><strong>${t('fileReadFailed')}</strong><span>${escapeHtml(error.message || t('unknownError'))}</span></div>`;
    showToast(error.message || t('fileReadFailed'), true);
  }
}

ui.openFolderButton.addEventListener('click', openLocalFolder);
ui.emptyOpenFolderButton.addEventListener('click', openLocalFolder);
ui.emptyDemoButton.addEventListener('click', openDemo);
ui.demoButton.addEventListener('click', openDemo);
ui.starPromptButton.href = GITHUB_REPOSITORY_URL;
ui.starPromptButton.addEventListener('click', dismissStarPrompt);
ui.starPromptLaterButton.addEventListener('click', dismissStarPrompt);
ui.themeButton.addEventListener('click', openThemeModal);
ui.dashboardButton.addEventListener('click', showDashboard);
ui.sidebarMoreButton.addEventListener('click', () => {
  setSidebarMenuOpen(ui.sidebarMenu.classList.contains('hidden'));
});
ui.overviewProgressButton.addEventListener('click', () => openOverviewModal('studied'));
ui.overviewRecentButton.addEventListener('click', () => openOverviewFile(ui.overviewRecentButton.dataset.path));
ui.overviewReviewButton.addEventListener('click', () => openOverviewModal('review'));
ui.sidebarMenu.addEventListener('click', (event) => {
  if (event.target.closest('button')) setSidebarMenuOpen(false);
});
ui.openVscodeButton.addEventListener('click', openSelectedFileInVscode);
ui.immersiveButton.addEventListener('click', () => setImmersiveMode(true));
ui.openLearningButton.addEventListener('click', () => {
  openLearningModal();
});
ui.immersiveExitButton.addEventListener('click', () => setImmersiveMode(false));
ui.closeLearningModalButton.addEventListener('click', closeLearningModal);
ui.closeOverviewModalButton.addEventListener('click', closeOverviewModal);
ui.searchInput.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderTree();
});
ui.addTodoButton.addEventListener('click', openTodoModal);
ui.closeTodoModalButton.addEventListener('click', closeTodoModal);
ui.cancelTodoButton.addEventListener('click', closeTodoModal);
ui.todoForm.addEventListener('submit', addTodo);
ui.recordStudyButton.addEventListener('click', recordStudy);
ui.todoModal.addEventListener('click', (event) => {
  if (event.target === ui.todoModal) closeTodoModal();
});
ui.learningModal.addEventListener('click', (event) => {
  if (event.target === ui.learningModal) closeLearningModal();
});
ui.overviewModal.addEventListener('click', (event) => {
  if (event.target === ui.overviewModal) closeOverviewModal();
});
ui.closeThemeModalButton.addEventListener('click', closeThemeModal);
ui.lightThemeModeButton.addEventListener('click', () => setThemeMode('light'));
ui.darkThemeModeButton.addEventListener('click', () => setThemeMode('dark'));
ui.zhLanguageButton.addEventListener('click', () => setLanguage('zh'));
ui.enLanguageButton.addEventListener('click', () => setLanguage('en'));
ui.themeModal.addEventListener('click', (event) => {
  if (event.target === ui.themeModal) closeThemeModal();
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.sidebar-footer')) setSidebarMenuOpen(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!ui.sidebarMenu.classList.contains('hidden')) setSidebarMenuOpen(false);
  else if (!ui.overviewModal.classList.contains('hidden')) closeOverviewModal();
  else if (!ui.learningModal.classList.contains('hidden')) closeLearningModal();
  else if (!ui.todoModal.classList.contains('hidden')) closeTodoModal();
  else if (!ui.themeModal.classList.contains('hidden')) closeThemeModal();
  else if (state.immersive) setImmersiveMode(false);
});

initializeTheme();
initializeLanguage();
initializeSidebarResizer();
initializeSidebarCollapse();
renderTree();
renderDashboard();
