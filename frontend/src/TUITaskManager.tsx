import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type SyncDirection = 'TO_TODOIST' | 'FROM_TODOIST' | 'BIDIRECTIONAL';

interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  todoistId?: string;
  syncStatus: string;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  priority: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  projectId: string;
  todoistId?: string;
  syncStatus: string;
  metadata?: any;
  parentId?: string;
  children?: Task[];
  assignedDays?: Array<{
    id: string;
    day: {
      id: string;
      date: string;
      week: {
        id: string;
        weekNumber: number;
        year: {
          id: string;
          year: number;
        };
      };
    };
  }>;
}

interface Year {
  id: string;
  year: number;
  weeks: Week[];
}

interface Week {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  year: Year;
  days: Day[];
}

interface Day {
  id: string;
  date: string;
  week: Week;
  tasks: Array<{
    id: string;
    task: Task;
  }>;
}

// OutlinerView Component
const OutlinerView: React.FC<{
  projects: Project[];
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  selectedProject: Project | undefined;
  selectedProjectIdx: number;
  selectedTaskIdx: number;
  setSelectedProjectIdx: (idx: number) => void;
  setSelectedTaskIdx: (idx: number) => void;
  activePane: string;
  setActivePane: (pane: string) => void;
  contextExpanded: boolean;
  selectedTask: Task | undefined;
  editingContext: boolean;
  contextText: string;
  setContextText: (text: string) => void;
  handleSaveContext: () => void;
  contextRef: React.RefObject<HTMLTextAreaElement>;
  getPriorityLabel: (priority: number) => string;
  getPriorityColor: (priority: number) => string;
  inputMode: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  formatText: (text: string) => JSX.Element[] | null;
}> = ({
  projects,
  tasks,
  setTasks,
  selectedProject,
  selectedProjectIdx,
  selectedTaskIdx,
  setSelectedProjectIdx,
  setSelectedTaskIdx,
  activePane,
  setActivePane,
  contextExpanded,
  selectedTask,
  editingContext,
  contextText,
  setContextText,
  handleSaveContext,
  contextRef,
  getPriorityLabel,
  getPriorityColor,
  inputMode,
  inputValue,
  setInputValue,
  inputRef,
  formatText,
}) => {
  // State for collapsible nodes
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const createProjectDragEndHandler = (projectId: string) => (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setTasks(prevTasks => {
      const projectTaskList = prevTasks.filter(task => task.projectId === projectId);
      const oldIndex = projectTaskList.findIndex(task => task.id === active.id);
      const newIndex = projectTaskList.findIndex(task => task.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return prevTasks;
      }

      const reorderedTasks = arrayMove(projectTaskList, oldIndex, newIndex);

      if (selectedProject?.id === projectId && selectedTask) {
        const newSelectedIndex = reorderedTasks.findIndex(task => task.id === selectedTask.id);
        if (newSelectedIndex !== -1) {
          setSelectedTaskIdx(newSelectedIndex);
        }
      }

      const updatedTasks: Task[] = [];
      let reorderedIndex = 0;
      for (const task of prevTasks) {
        if (task.projectId === projectId) {
          updatedTasks.push(reorderedTasks[reorderedIndex++]);
        } else {
          updatedTasks.push(task);
        }
      }

      return updatedTasks;
    });
  };

  // Group tasks by project for outliner view
  const projectTasks = tasks.reduce((acc, task) => {
    if (!acc[task.projectId]) {
      acc[task.projectId] = [];
    }
    acc[task.projectId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Get filtered tasks for current project
  // Simple date hierarchy for demo (in real implementation, fetch from API)
  const currentYear = new Date().getFullYear();
  const currentWeek = Math.ceil((new Date().getDate() - new Date(currentYear, 0, 1).getDate() + 1) / 7);

  // Toggle node collapse state
  const toggleNodeCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes(prev => {
      const newCollapsed = new Set(prev);
      if (newCollapsed.has(nodeId)) {
        newCollapsed.delete(nodeId);
      } else {
        newCollapsed.add(nodeId);
      }
      return newCollapsed;
    });
  }, []);

  const handleProjectSelect = (projectIdx: number, projectTaskList: Task[]) => {
    setSelectedProjectIdx(projectIdx);

    if (projectIdx !== selectedProjectIdx) {
      setSelectedTaskIdx(0);
    } else if (projectTaskList.length > 0 && selectedTaskIdx >= projectTaskList.length) {
      setSelectedTaskIdx(projectTaskList.length - 1);
    } else if (projectTaskList.length === 0) {
      setSelectedTaskIdx(0);
    }

    setActivePane('tasks');
  };

  const handleTaskSelect = (projectIdx: number, projectTaskList: Task[], taskId: string) => {
    if (projectIdx !== selectedProjectIdx) {
      setSelectedProjectIdx(projectIdx);
    }

    const taskIndex = projectTaskList.findIndex(task => task.id === taskId);
    if (taskIndex !== -1) {
      setSelectedTaskIdx(taskIndex);
      setActivePane('tasks');
    }
  };

  // Check if node is collapsed
  const isCollapsed = useCallback((nodeId: string) => collapsedNodes.has(nodeId), [collapsedNodes]);

  // Draggable Task Component
  const DraggableTask: React.FC<{
    task: Task;
    isSelected: boolean;
    onSelect: () => void;
    hasNotes: boolean;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    completed: boolean;
    text: string;
  }> = ({ task, isSelected, onSelect, hasNotes, isCollapsed, onToggleCollapse, completed, text }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: task.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <div ref={setNodeRef} style={style} {...attributes} className="ml-4 mb-1">
        {/* Task Node - Draggable */}
        <div
          className={`px-3 py-1 cursor-pointer flex items-center gap-2 relative group ${
            isSelected ? 'bg-slate-700 text-white' : 'hover:bg-slate-800/30'
          }`}
          onClick={onSelect}
          style={{ position: 'relative' }}
        >
          {/* Invisible drag handle - covers the entire node */}
          <div
            {...attributes}
            {...listeners}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ zIndex: 1 }}
          />

          {/* Simple bullet - Tana style */}
          <span className="text-gray-400 text-sm">•</span>

          {/* Completion status - no colors, consistent sizing */}
          <span className={`text-sm ${completed ? 'text-green-500' : 'text-gray-400'}`}>
            {completed ? '✓' : '○'}
          </span>

          {/* Task text - no colors, consistent sizing, no priority display */}
          <span className={`flex-1 text-sm ${completed ? 'line-through text-gray-500' : ''}`}>
            {text}
          </span>

          {/* Expand/collapse chevron - only visible on hover */}
          {hasNotes && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleCollapse();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-300 text-xs z-10 relative"
            >
              {isCollapsed ? '▶' : '▼'}
            </button>
          )}
        </div>

        {/* Nested notes as pure indented bullets */}
        {!isCollapsed && task.notes && (
          <div className="ml-6">
            <div className="px-3 py-0.5 text-sm text-gray-400">
              • {task.notes}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Outliner Content */}
      <div className={`${contextExpanded ? 'hidden' : 'flex-1'} flex flex-col h-full`}>
        <div className="bg-slate-800 px-3 py-1.5 border-b border-slate-700 flex-shrink-0">
          <span className="text-xs uppercase tracking-wide text-gray-400">Outliner</span>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Projects as top-level nodes */}
          {projects.map((project, projectIdx) => {
            const projectId = `project-${project.id}`;
            const isProjectCollapsed = isCollapsed(projectId);
            const projectTaskList = projectTasks[project.id] || [];
            const hasChildren = projectTaskList.length > 0;

            return (
              <div key={project.id} className="mb-1">
                {/* Project Node - Pure outliner design */}
                <div
                  className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 relative group ${
                    projectIdx === selectedProjectIdx ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/50'
                  }`}
                  onClick={() => handleProjectSelect(projectIdx, projectTaskList)}
                >
                  {/* Simple bullet - Tana style */}
                  <span className="text-gray-400 text-sm">•</span>

                  {/* Project name - no color, consistent sizing */}
                  <span className="flex-1 text-sm">{project.name}</span>

                  {/* Expand/collapse chevron - only visible on hover */}
                  {hasChildren && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleNodeCollapse(projectId);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-300 text-xs z-10 relative"
                    >
                      {isProjectCollapsed ? '▶' : '▼'}
                    </button>
                  )}
                </div>

                {/* Tasks under project - Drag and Drop enabled */}
                {!isProjectCollapsed && projectTaskList.length > 0 && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={createProjectDragEndHandler(project.id)}
                  >
                    <SortableContext
                      items={projectTaskList.map(task => task.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {projectTaskList.map((task) => {
                        const taskId = `task-${task.id}`;
                        const isTaskCollapsed = isCollapsed(taskId);
                        const hasNotes = task.notes && task.notes.trim().length > 0;

                        return (
                          <DraggableTask
                            key={task.id}
                            task={task}
                            isSelected={selectedProject?.id === project.id && task.id === selectedTask?.id}
                            onSelect={() => handleTaskSelect(projectIdx, projectTaskList, task.id)}
                            hasNotes={!!hasNotes}
                            isCollapsed={isTaskCollapsed}
                            onToggleCollapse={() => toggleNodeCollapse(taskId)}
                            completed={task.completed}
                            text={task.text}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                )}

                {/* Add task input for project - Clean simple design */}
                {inputMode && activePane === 'tasks' && project.id === selectedProject?.id && (
                  <div className="ml-4 mb-1">
                    <div className="px-3 py-1 bg-slate-800">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="w-full bg-slate-900 text-white px-2 py-1 outline-none border border-slate-600 text-sm"
                        placeholder="New task..."
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Date Hierarchy Section - Clean simple design */}
          <div className="mb-1">
            <div className="px-3 py-1.5 bg-slate-700">
              <span className="text-sm font-medium text-gray-300">📅 Date Structure</span>
            </div>

            {/* Year - Clean simple design */}
            <div className="ml-4">
              <div className="px-3 py-1 flex items-center gap-2">
                <span className="text-gray-400 text-sm">•</span>
                <span className="font-medium">{currentYear}</span>
              </div>

              {/* Week - Clean simple design */}
              <div className="ml-4">
                <div className="px-3 py-0.5 flex items-center gap-2">
                  <span className="text-gray-400 text-xs">•</span>
                  <span>Week {currentWeek}</span>
                </div>

                {/* Days - Clean simple design */}
                <div className="ml-4">
                  <div className="px-3 py-0.5 text-xs text-gray-500">
                    • Days with tasks would appear here...
                  </div>
                </div>
              </div>
            </div>
          </div>

          {projects.length === 0 && (
            <div className="px-3 py-8 text-center text-gray-600 text-xs">
              No projects. Create a project to get started.
            </div>
          )}
        </div>
      </div>

      {/* Context pane for outliner - Always editing mode */}
      <div className={`${contextExpanded ? 'flex-1' : 'h-40'} flex flex-col border-t border-slate-700`}>
        <div className="bg-slate-800 px-3 py-1.5 border-b border-slate-700 flex-shrink-0">
          <span className="text-xs uppercase tracking-wide text-gray-400">Notes</span>
        </div>
        <div className={`flex-1 px-3 py-2 ${activePane === 'context' ? 'bg-slate-800' : 'bg-slate-900'}`}>
          {selectedTask ? (
            <div className="h-full flex flex-col">
              {/* Task header - always visible */}
              <div className="mb-3 pb-2 border-b border-slate-700">
                <div className="text-xs text-gray-500 mb-1">Task:</div>
                <div className="text-sm text-gray-300">{selectedTask.text}</div>
              </div>

              {/* Single editing interface - no read-only mode */}
              <div className="flex-1 flex flex-col">
                <div className="text-xs text-gray-500 mb-2">
                  Notes (ESC to exit and save, Ctrl+Enter to save):
                </div>
                <div className="flex-1 relative bg-slate-900 border border-slate-600">
                  <textarea
                    ref={contextRef}
                    value={contextText}
                    onChange={(e) => setContextText(e.target.value)}
                    className="w-full h-full bg-transparent text-gray-300 px-2 py-1 outline-none resize-none text-sm relative z-10"
                    placeholder="Add notes about this task...&#10;&#10;Formatting:&#10;**bold** for bold text&#10;*italics* for italic text&#10;# Header for larger header&#10;- bullet points&#10;  - nested bullets"
                    autoFocus
                  />
                  {/* Live WYSIWYG preview */}
                  <div className="absolute inset-0 w-full h-full text-gray-300 px-2 py-1 text-sm overflow-y-auto pointer-events-none whitespace-pre-wrap break-words">
                    {contextText.trim() ? (
                      <div className="opacity-50">
                        {formatText(contextText)}
                      </div>
                    ) : (
                      <div className="opacity-30 italic">
                        Add notes about this task...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-600 text-sm">
              Select a task to edit notes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TUITaskManager = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [activePane, setActivePane] = useState('projects');
  const [selectedProjectIdx, setSelectedProjectIdx] = useState(0);
  const [selectedTaskIdx, setSelectedTaskIdx] = useState(0);
  const [inputMode, setInputMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [contextExpanded, setContextExpanded] = useState(false);
  const [editingContext, setEditingContext] = useState(false);
  const [contextText, setContextText] = useState('');
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [selectedBookmarkIdx, setSelectedBookmarkIdx] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [todoistModalOpen, setTodoistModalOpen] = useState(false);
  const [todoistToken, setTodoistToken] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncDirection, setSyncDirection] = useState<SyncDirection>('FROM_TODOIST');
  const [realTimeSync, setRealTimeSync] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [viewMode, setViewMode] = useState<'classic' | 'outliner'>('classic');
  const [fontMode, setFontMode] = useState<'proportional' | 'monospace'>('monospace');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    open: boolean;
    type: 'task' | 'project';
    item: Task | Project | null;
  }>({ open: false, type: 'task', item: null });
  const inputRef = useRef<HTMLInputElement>(null);
  const contextRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch data from backend
  const fetchProjects = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProjects(), fetchTasks()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // WebSocket connection for real-time sync
  useEffect(() => {
    if (realTimeSync) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:3001`;

      console.log('Connecting to real-time sync WebSocket...');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to real-time sync WebSocket');
        setWsConnected(true);
        // Send start auto-sync message
        ws.send(JSON.stringify({ type: 'START_AUTO_SYNC' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealTimeMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from real-time sync WebSocket');
        setWsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'STOP_AUTO_SYNC' }));
        }
        ws.close();
      };
    }
  }, [realTimeSync]);

  const handleRealTimeMessage = (data: any) => {
    switch (data.type) {
      case 'AUTO_SYNC_COMPLETED':
        console.log('Auto-sync completed:', data.summary);
        // Refresh data
        Promise.all([fetchProjects(), fetchTasks()]);
        setSyncResult({
          success: true,
          summary: data.summary,
          timestamp: data.timestamp
        });
        break;

      case 'AUTO_SYNC_ERROR':
        console.error('Auto-sync error:', data.error);
        setSyncResult({
          success: false,
          error: data.error,
          timestamp: data.timestamp
        });
        break;

      case 'connected':
        console.log('WebSocket connected:', data.message);
        break;

      default:
        console.log('Unknown WebSocket message:', data);
    }
  };

  const selectedProject = projects[selectedProjectIdx];
  const filteredTasks = tasks.filter(t => t.projectId === selectedProject?.id);
  const selectedTask = filteredTasks[selectedTaskIdx];

  const handleSaveContext = async (): Promise<void> => {
    if (selectedTask) {
      try {
        // Update the task in the backend database
        const response = await fetch(`http://localhost:3001/api/tasks/${selectedTask.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: contextText,
            syncStatus: 'PENDING_UPLOAD' // Mark for upload to Todoist
          }),
        });

        if (response.ok) {
          // Update local state after successful backend update
          setTasks(tasks.map(t =>
            t.id === selectedTask.id ? { ...t, notes: contextText } : t
          ));
        }
      } catch (error) {
        console.error('Failed to save notes to backend:', error);
        // Still update local state even if backend fails
        setTasks(tasks.map(t =>
          t.id === selectedTask.id ? { ...t, notes: contextText } : t
        ));
      }
    }
    setEditingContext(false);
    setContextText('');
  };

  const extractUrls = (text: string) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const currentBookmarks = selectedTask ? extractUrls(selectedTask.notes) : [];

  // Simple text formatter for WYSIWYG display
  const formatText = (text: string) => {
    if (!text) return null;

    // Split by newlines to handle block-level formatting
    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Handle headers (# Header)
      if (line.startsWith('# ')) {
        return (
          <div key={index} className="text-base font-semibold text-gray-200 mb-1">
            {line.substring(2)}
          </div>
        );
      }

      // Handle bullet points (- item or * item)
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <div key={index} className="flex items-start gap-2 mb-1">
            <span className="text-gray-400 text-sm mt-0.5">•</span>
            <span className="flex-1">{formatInlineText(line.substring(2))}</span>
          </div>
        );
      }

      // Handle nested bullet points (indented with spaces)
      if (line.startsWith('  - ') || line.startsWith('  * ')) {
        return (
          <div key={index} className="flex items-start gap-2 mb-1 ml-4">
            <span className="text-gray-500 text-xs mt-0.5">◦</span>
            <span className="flex-1 text-sm">{formatInlineText(line.substring(4))}</span>
          </div>
        );
      }

      // Regular text
      return (
        <div key={index} className="mb-1">
          {formatInlineText(line)}
        </div>
      );
    });
  };

  // Format inline text (**bold**, *italics*)
  const escapeHtml = (unsafeText: string) =>
    unsafeText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatInlineText = (text: string) => {
    if (!text) return text;

    let safeText = escapeHtml(text);

    // Handle **bold**
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-200">$1</strong>');

    // Handle *italics*
    safeText = safeText.replace(/\*(.*?)\*/g, '<em class="italic text-gray-300">$1</em>');

    // Handle URLs
    safeText = safeText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>');

    return <span dangerouslySetInnerHTML={{ __html: safeText }} />;
  };


  useEffect(() => {
    if (selectedBookmarkIdx >= currentBookmarks.length) {
      setSelectedBookmarkIdx(Math.max(0, currentBookmarks.length - 1));
    }
  }, [currentBookmarks.length, selectedBookmarkIdx]);

  useEffect(() => {
    if (inputMode && inputRef.current) {
      inputRef.current.focus();
    }
    if (editingContext && contextRef.current) {
      contextRef.current.focus();
      // Set cursor to end of text
      const textarea = contextRef.current;
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [inputMode, editingContext]);

  // Focus the Todoist token input when modal opens
  useEffect(() => {
    if (todoistModalOpen) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        const tokenInput = document.querySelector('input[type="password"]') as HTMLInputElement;
        if (tokenInput) {
          tokenInput.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [todoistModalOpen]);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    // Don't handle if we're typing in an input or textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Don't handle keyboard shortcuts when Todoist modal is open
    if (todoistModalOpen) {
      return;
    }

    // Handle Enter key for confirmation dialog
    if (deleteConfirmation.open && e.key === 'Enter') {
      e.preventDefault();
      if (deleteConfirmation.type === 'task' && deleteConfirmation.item) {
        handleDeleteTask(deleteConfirmation.item as Task);
      } else if (deleteConfirmation.type === 'project' && deleteConfirmation.item) {
        handleDeleteProject(deleteConfirmation.item as Project);
      }
      setDeleteConfirmation({ open: false, type: 'task', item: null });
      return;
    }

    console.log('Key pressed:', e.key, 'Active pane:', activePane); // Debug log

    if (inputMode) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setInputMode(false);
        setInputValue('');
        if (contextExpanded) {
          setContextExpanded(false);
        }
      } else if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        if (activePane === 'projects') {
          try {
            const response = await fetch('http://localhost:3001/api/projects', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: inputValue,
                color: ['blue', 'red', 'green', 'yellow', 'purple'][Math.floor(Math.random() * 5)],
                syncStatus: 'PENDING_UPLOAD'
              }),
            });

            if (response.ok) {
              const newProject = await response.json();
              setProjects([...projects, newProject]);
            }
          } catch (error) {
            console.error('Failed to create project:', error);
          }
        } else if (activePane === 'tasks') {
          try {
            const response = await fetch('http://localhost:3001/api/tasks', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: inputValue,
                projectId: selectedProject.id,
                completed: false,
                priority: 2,
                notes: '',
                syncStatus: 'PENDING_UPLOAD'
              }),
            });

            if (response.ok) {
              const newTask = await response.json();
              setTasks([...tasks, newTask]);
            }
          } catch (error) {
            console.error('Failed to create task:', error);
          }
        }
        setInputValue('');
        setInputMode(false);
      }
      return;
    }

    if (editingContext) {
      if (e.key === 'Escape') {
        e.preventDefault();
        // Save and exit immediately - no async issues
        if (selectedTask && contextText !== selectedTask.notes) {
          // Update local state immediately for responsive UX
          setTasks(tasks.map(t =>
            t.id === selectedTask.id ? { ...t, notes: contextText } : t
          ));
        }
        setEditingContext(false);
        setContextExpanded(false);
        setActivePane('tasks');
        setContextText('');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Insert tab for indentation instead of deleting
        const textarea = contextRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newText = contextText.substring(0, start) + '  ' + contextText.substring(end);
          setContextText(newText);
          // Set cursor position after inserted spaces
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = start + 2;
          }, 0);
        }
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        // Save and exit
        if (selectedTask && contextText !== selectedTask.notes) {
          setTasks(tasks.map(t =>
            t.id === selectedTask.id ? { ...t, notes: contextText } : t
          ));
        }
        setEditingContext(false);
        setContextExpanded(false);
        setActivePane('tasks');
        setContextText('');
      }
      // Allow normal typing but prevent other navigation
      return;
    }

    if (bookmarksOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setBookmarksOpen(false);
        setSelectedBookmarkIdx(0);
      } else if (e.key === 'j') {
        e.preventDefault();
        setSelectedBookmarkIdx(Math.min(currentBookmarks.length - 1, selectedBookmarkIdx + 1));
      } else if (e.key === 'k') {
        e.preventDefault();
        setSelectedBookmarkIdx(Math.max(0, selectedBookmarkIdx - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentBookmarks[selectedBookmarkIdx]) {
          window.open(currentBookmarks[selectedBookmarkIdx], '_blank');
        }
      }
      return;
    }

    switch(e.key) {
      case 'h':
      case 'ArrowLeft':
        e.preventDefault();
        if (activePane === 'tasks') setActivePane('projects');
        else if (activePane === 'context') setActivePane('tasks');
        break;
      case 'l':
      case 'ArrowRight':
        e.preventDefault();
        if (activePane === 'projects') {
          // Only navigate to tasks if project has tasks, otherwise stay in place
          if (filteredTasks.length > 0) {
            setActivePane('tasks');
            // Ensure first task is selected when entering task pane
            setSelectedTaskIdx(0);
          }
        }
        // Removed: No longer navigate to context pane from tasks
        break;
      case 'j':
      case 'ArrowDown':
        e.preventDefault();
        if (activePane === 'projects') {
          setSelectedProjectIdx(Math.min(projects.length - 1, selectedProjectIdx + 1));
        } else if (activePane === 'tasks') {
          setSelectedTaskIdx(Math.min(filteredTasks.length - 1, selectedTaskIdx + 1));
        }
        break;
      case 'k':
      case 'ArrowUp':
        e.preventDefault();
        if (activePane === 'projects') {
          setSelectedProjectIdx(Math.max(0, selectedProjectIdx - 1));
        } else if (activePane === 'tasks') {
          setSelectedTaskIdx(Math.max(0, selectedTaskIdx - 1));
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (activePane === 'tasks' && selectedTask) {
          // Immediately enter context pane in edit mode
          setContextExpanded(true);
          setActivePane('context');
          setEditingContext(true);
          setContextText(selectedTask?.notes || '');
          // Focus will be handled by useEffect
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (editingContext) {
          // Cancel editing and exit context pane
          setEditingContext(false);
          setContextText('');
          setContextExpanded(false);
          setActivePane('tasks');
        } else if (contextExpanded) {
          // Exit context pane back to tasks
          setContextExpanded(false);
          setActivePane('tasks');
        }
        break;
      case 'i':
        e.preventDefault();
        if (activePane === 'context' && selectedTask && !editingContext) {
          setEditingContext(true);
          setContextText(selectedTask?.notes || '');
        }
        break;
      case 'b':
        e.preventDefault();
        if (selectedTask && currentBookmarks.length > 0) {
          setBookmarksOpen(true);
          setSelectedBookmarkIdx(0);
        }
        break;
      case 'a':
        e.preventDefault();
        if (!contextExpanded && !inputMode) {
          setInputMode(true);
        }
        break;
      case 'x':
        e.preventDefault();
        if (activePane === 'tasks' && selectedTask) {
          try {
            fetch(`http://localhost:3001/api/tasks/${selectedTask.id}/toggle`, {
              method: 'PATCH',
            }).then(response => {
              if (response.ok) {
                setTasks(tasks.map(t =>
                  t.id === selectedTask.id ? { ...t, completed: !t.completed } : t
                ));
              }
            }).catch(error => {
              console.error('Failed to toggle task:', error);
              // Still update local state even if backend fails
              setTasks(tasks.map(t =>
                t.id === selectedTask.id ? { ...t, completed: !t.completed } : t
              ));
            });
          } catch (error) {
            console.error('Failed to toggle task:', error);
            setTasks(tasks.map(t =>
              t.id === selectedTask.id ? { ...t, completed: !t.completed } : t
            ));
          }
        }
        break;
      case 'd':
        e.preventDefault();
        if (activePane === 'tasks' && selectedTask) {
          setDeleteConfirmation({
            open: true,
            type: 'task',
            item: selectedTask
          });
        } else if (activePane === 'projects' && projects.length > 1) {
          setDeleteConfirmation({
            open: true,
            type: 'project',
            item: selectedProject
          });
        }
        break;
      case 's':
        e.preventDefault();
        if (!contextExpanded && !inputMode && !bookmarksOpen) {
          setTodoistModalOpen(true);
        }
        break;
      case 't':
        e.preventDefault();
        if (!contextExpanded && !inputMode && !bookmarksOpen && !deleteConfirmation.open) {
          setFontMode(fontMode === 'monospace' ? 'proportional' : 'monospace');
        }
        break;
    }
  }, [activePane, selectedProjectIdx, selectedTaskIdx, projects, tasks, inputMode, inputValue, selectedProject, filteredTasks, selectedTask, contextExpanded, editingContext, bookmarksOpen, selectedBookmarkIdx, currentBookmarks, contextText]);

  // Focus management
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.focus();
        console.log('Focused container'); // Debug log
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Ensure focus when clicking anywhere in the app
  const handleContainerClick = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Ensure we always have a valid task selection when tasks are available
    if (filteredTasks.length > 0) {
      if (selectedTaskIdx >= filteredTasks.length) {
        setSelectedTaskIdx(Math.max(0, filteredTasks.length - 1));
      }
    } else {
      // No tasks available - reset selection
      setSelectedTaskIdx(0);
    }
  }, [filteredTasks.length, selectedTaskIdx]);

  const getPriorityLabel = (priority: number) => {
    const labels: { [key: number]: string } = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };
    return labels[priority] || 'P2';
  };

  const getPriorityColor = (priority: number) => {
    const colors: { [key: number]: string } = {
      1: 'text-red-400',
      2: 'text-yellow-400',
      3: 'text-blue-400',
      4: 'text-gray-500'
    };
    return colors[priority] || 'text-gray-500';
  };

  const handleSync = async (direction: SyncDirection = syncDirection) => {
    if (!todoistToken.trim()) {
      setSyncResult({
        success: false,
        error: 'Please enter your Todoist API token'
      });
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      // First, save the token to the backend
      const tokenResponse = await fetch('http://localhost:3001/api/config/todoist-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: todoistToken }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to save API token');
      }

      // Then perform sync based on selected direction
      const syncResponse = await fetch('http://localhost:3001/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          direction,
          entityType: 'all'
        }),
      });

      const syncData = await syncResponse.json();

      if (syncResponse.ok && syncData.success) {
        setSyncResult({
          success: true,
          ...syncData
        });

        // Refresh local data for all sync directions
        await Promise.all([fetchProjects(), fetchTasks()]);
      } else {
        let errorMessage = 'Sync failed - please check your API token and try again';
        if (syncData.error && syncData.error.includes('Authentication')) {
          errorMessage = 'Invalid API token - please check your Todoist API token from Settings → Integrations → Developer';
        } else if (syncData.error) {
          errorMessage = syncData.error;
        }

        setSyncResult({
          success: false,
          error: errorMessage
        });
      }
    } catch (error) {
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFromTodoist = async () => {
    const direction: SyncDirection = 'FROM_TODOIST';
    setSyncDirection(direction);
    await handleSync(direction);
  };

  const handleSyncToTodoist = async () => {
    const direction: SyncDirection = 'TO_TODOIST';
    setSyncDirection(direction);
    await handleSync(direction);
  };

  const handleBidirectionalSync = async () => {
    const direction: SyncDirection = 'BIDIRECTIONAL';
    setSyncDirection(direction);
    await handleSync(direction);
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      const response = await fetch(`http://localhost:3001/api/tasks/${task.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks(tasks.filter(t => t.id !== task.id));
        setSelectedTaskIdx(Math.max(0, selectedTaskIdx - 1));
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      // Still update local state even if backend fails
      setTasks(tasks.filter(t => t.id !== task.id));
      setSelectedTaskIdx(Math.max(0, selectedTaskIdx - 1));
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (projects.length <= 1) return; // Don't delete the last project

    try {
      const response = await fetch(`http://localhost:3001/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as { error?: string }).error || 'Failed to delete project');
      }

      setProjects(projects.filter((_, idx) => idx !== selectedProjectIdx));
      setSelectedProjectIdx(Math.max(0, selectedProjectIdx - 1));
      setTasks(tasks.filter(t => t.projectId !== project.id));
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-300 font-mono flex items-center justify-center text-sm" style={{ backgroundColor: '#0f172a', color: '#d1d5db', fontFamily: 'Courier New, monospace' }}>
        <div className="text-center">
          <div className="text-lg mb-2">Loading TUIist...</div>
          <div className="text-xs text-gray-500">Connecting to backend...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleContainerClick}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={`min-h-screen bg-gray-900 text-gray-300 flex flex-col text-sm focus:outline-none cursor-default ${
        isFocused ? 'ring-2 ring-blue-500' : ''
      }`}
      style={{
        height: '100vh',
        backgroundColor: '#0f172a',
        color: '#d1d5db',
        fontFamily: fontMode === 'monospace' ? 'Courier New, monospace' : 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Bookmarks Modal */}
      {bookmarksOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-600 rounded w-2/3 max-h-96 flex flex-col">
            <div className="bg-slate-700 px-3 py-2 border-b border-slate-600">
              <span className="text-xs uppercase tracking-wide text-gray-300">
                Bookmarks ({currentBookmarks.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {currentBookmarks.map((url: string, idx: number) => (
                <div
                  key={idx}
                  className={`px-3 py-2 border-b border-slate-700 cursor-pointer ${
                    idx === selectedBookmarkIdx
                      ? 'bg-indigo-600 text-white'
                      : 'hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">🔗</span>
                    <span className="text-sm truncate">{url}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-700 px-3 py-1.5 border-t border-slate-600">
              <div className="flex gap-3 text-xs text-gray-400">
                <span><span className="text-gray-300">j/k</span> navigate</span>
                <span><span className="text-gray-300">Enter</span> open</span>
                <span><span className="text-gray-300">ESC</span> close</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.open && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-600 rounded-lg w-96 max-w-2xl flex flex-col">
            <div className="bg-slate-700 px-4 py-3 border-b border-slate-600">
              <h2 className="text-lg font-semibold text-gray-300">CONFIRM DELETION</h2>
            </div>

            <div className="p-4">
              <div className="text-sm text-gray-300 mb-4">
                Are you sure you want to delete this {deleteConfirmation.type}?
                {deleteConfirmation.type === 'task' && deleteConfirmation.item && (
                  <div className="mt-2 p-2 bg-slate-900 rounded text-xs font-mono">
                    "{(deleteConfirmation.item as Task).text}"
                  </div>
                )}
                {deleteConfirmation.type === 'project' && deleteConfirmation.item && (
                  <div className="mt-2 p-2 bg-slate-900 rounded text-xs font-mono">
                    "{(deleteConfirmation.item as Project).name}"
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 mb-4">
                This action cannot be undone.
              </div>
            </div>

            <div className="bg-slate-700 px-4 py-3 border-t border-slate-600 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmation({ open: false, type: 'task', item: null })}
                className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-gray-300 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmation.type === 'task' && deleteConfirmation.item) {
                    handleDeleteTask(deleteConfirmation.item as Task);
                  } else if (deleteConfirmation.type === 'project' && deleteConfirmation.item) {
                    handleDeleteProject(deleteConfirmation.item as Project);
                  }
                  setDeleteConfirmation({ open: false, type: 'task', item: null });
                }}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Todoist Integration Modal */}
      {todoistModalOpen && (
        <div
          className="absolute inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setTodoistModalOpen(false)}
        >
          <div
            className="bg-slate-800 border border-slate-600 rounded-lg w-2/3 max-w-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-700 px-4 py-3 border-b border-slate-600">
              <h2 className="text-lg font-semibold text-gray-300">TODOIST INTEGRATION</h2>
            </div>

            <div className="p-4 space-y-4">
              {/* API Token Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400">
                  Todoist API Token
                </label>
                <input
                  type="password"
                  value={todoistToken}
                  onChange={(e) => setTodoistToken(e.target.value)}
                  className="w-full bg-slate-900 text-white px-3 py-2 border border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your Todoist API token..."
                />
                <p className="text-xs text-gray-500">
                  Get your token from: <span className="text-blue-400">Settings → Integrations → Developer → API Token</span>
                </p>
              </div>

              {/* Sync Result Display */}
              {syncResult && (
                <div className={`p-3 rounded border ${
                  syncResult.success
                    ? 'bg-green-900/20 border-green-600 text-green-300'
                    : 'bg-red-900/20 border-red-600 text-red-300'
                }`}>
                  <div className="text-sm">
                    {syncResult.success ? '✅ Sync Successful!' : '❌ Sync Failed'}
                  </div>
                  {syncResult.summary && (
                    <div className="text-xs mt-1 space-y-1">
                      <div>Total: {syncResult.summary.total}</div>
                      <div>Created: {syncResult.summary.created}</div>
                      <div>Updated: {syncResult.summary.updated}</div>
                      <div>Errors: {syncResult.summary.errors}</div>
                    </div>
                  )}
                  {syncResult.error && (
                    <div className="text-xs mt-1 text-red-400">
                      {syncResult.error}
                    </div>
                  )}
                </div>
              )}

              {/* Real-time Sync Toggle */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={realTimeSync}
                    onChange={(e) => setRealTimeSync(e.target.checked)}
                    className="text-blue-500"
                  />
                  <span className="text-gray-300">Enable Real-time Sync</span>
                  <span className="text-xs text-gray-500">
                    {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
                  </span>
                </label>
                <p className="text-xs text-gray-500">
                  Automatically sync changes in real-time with Todoist
                </p>
              </div>

              {/* Sync Direction Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-400">
                  Manual Sync Direction {!realTimeSync && '(Required)'}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 text-xs">
                    <input
                      type="radio"
                      name="syncDirection"
                      value="FROM_TODOIST"
                      checked={syncDirection === 'FROM_TODOIST'}
                      onChange={(e) => setSyncDirection(e.target.value)}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">From Todoist</span>
                    <span className="text-gray-500">- Download projects and tasks to local</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs">
                    <input
                      type="radio"
                      name="syncDirection"
                      value="TO_TODOIST"
                      checked={syncDirection === 'TO_TODOIST'}
                      onChange={(e) => setSyncDirection(e.target.value)}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">To Todoist</span>
                    <span className="text-gray-500">- Upload local changes to Todoist</span>
                  </label>
                  <label className="flex items-center space-x-2 text-xs">
                    <input
                      type="radio"
                      name="syncDirection"
                      value="BIDIRECTIONAL"
                      checked={syncDirection === 'BIDIRECTIONAL'}
                      onChange={(e) => setSyncDirection(e.target.value)}
                      className="text-blue-500"
                    />
                    <span className="text-gray-300">Bidirectional</span>
                    <span className="text-gray-500">- Upload local changes, then download updates</span>
                  </label>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400">Features:</h3>
                <ul className="text-xs text-gray-500 space-y-1">
                  <li>• Sync projects and tasks from Todoist</li>
                  <li>• Upload local changes to Todoist</li>
                  <li>• Bidirectional sync support</li>
                  <li>• Real-time automatic sync</li>
                  <li>• Import task descriptions as notes</li>
                  <li>• Preserve priority levels</li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-700 px-4 py-3 border-t border-slate-600 flex justify-between items-center">
              <div className="flex gap-3 text-xs text-gray-400">
                <span><span className="text-gray-300">ESC</span> close</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setTodoistModalOpen(false)}
                  className="px-4 py-2 text-sm bg-slate-600 hover:bg-slate-500 text-gray-300 rounded transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={handleSync}
                  disabled={!todoistToken.trim() || isSyncing || realTimeSync}
                  className={`px-4 py-2 text-sm rounded transition-colors ${
                    !todoistToken.trim() || isSyncing || realTimeSync
                      ? 'bg-slate-600 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {isSyncing
                    ? 'Syncing...'
                    : realTimeSync
                      ? 'Real-time Sync Active'
                      : syncDirection === 'FROM_TODOIST'
                        ? 'Sync from Todoist'
                        : syncDirection === 'TO_TODOIST'
                          ? 'Sync to Todoist'
                          : 'Bidirectional Sync'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with view toggle */}
      <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-300">TUIist</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('classic')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'classic'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
            >
              Classic
            </button>
            <button
              onClick={() => setViewMode('outliner')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                viewMode === 'outliner'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
              }`}
            >
              Outliner
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {viewMode === 'classic' ? 'Classic View' : 'Outliner View'}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Projects pane */}
        <div className="w-64 border-r border-slate-700 flex flex-col">
          <div className="bg-slate-800 px-3 py-1.5 border-b border-slate-700">
            <span className="text-xs uppercase tracking-wide text-gray-400">Projects</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {projects.map((project, idx) => (
              <div
                key={project.id}
                className={`px-3 py-1.5 border-b border-slate-800 cursor-pointer ${
                  idx === selectedProjectIdx
                    ? activePane === 'projects'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700/50'
                    : 'hover:bg-slate-800'
                }`}
                onClick={() => setSelectedProjectIdx(idx)}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-${project.color}-400 text-xs`}>●</span>
                  <span className="flex-1">{project.name}</span>
                  <span className="text-xs text-gray-500">
                    {tasks.filter(t => t.projectId === project.id).length}
                  </span>
                </div>
              </div>
            ))}
            {inputMode && activePane === 'projects' && (
              <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-800">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full bg-slate-900 text-white px-2 py-1 outline-none border border-slate-600"
                  placeholder="New project..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Content Area - Classic vs Outliner View */}
        <div className="flex-1 flex flex-col">
          {viewMode === 'classic' ? (
            /* Classic View */
            <>
              {/* Tasks pane */}
              <div className={`${contextExpanded ? 'hidden' : 'flex-1'} border-b border-slate-700 flex flex-col`}>
                <div className="bg-slate-800 px-3 py-1.5 border-b border-slate-700">
                  <span className="text-xs uppercase tracking-wide text-gray-400">
                    {selectedProject?.name || 'Tasks'}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredTasks.map((task, idx) => (
                    <div
                      key={task.id}
                      className={`px-3 py-1.5 border-b border-slate-800 cursor-pointer ${
                        idx === selectedTaskIdx
                          ? activePane === 'tasks'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-700/50'
                          : 'hover:bg-slate-800'
                      }`}
                      onClick={() => setSelectedTaskIdx(idx)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${task.completed ? 'text-green-500' : 'text-gray-400'}`}>
                          {task.completed ? '✓' : '○'}
                        </span>
                        <span className={`flex-1 ${task.completed ? 'line-through text-gray-500' : ''}`}>
                          {task.text}
                        </span>
                        <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {getPriorityLabel(task.priority)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {inputMode && activePane === 'tasks' && (
                    <div className="px-3 py-1.5 border-b border-slate-800 bg-slate-800">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="w-full bg-slate-900 text-white px-2 py-1 outline-none border border-slate-600"
                        placeholder="New task..."
                      />
                    </div>
                  )}
                  {filteredTasks.length === 0 && !inputMode && (
                    <div className="px-3 py-8 text-center text-gray-600 text-xs">
                      No tasks. Press 'a' to add one.
                    </div>
                  )}
                </div>
              </div>

              {/* Context pane - Simplified for classic view */}
              <div className={`${contextExpanded ? 'flex-1' : 'h-40'} flex flex-col border-t border-slate-700`}>
                <div className="bg-slate-800 px-3 py-1.5 border-b border-slate-700">
                  <span className="text-xs uppercase tracking-wide text-gray-400">Notes</span>
                </div>
                <div className={`flex-1 overflow-y-auto px-3 py-2 ${
                  activePane === 'context' ? 'bg-slate-800' : 'bg-slate-900'
                }`}>
                  {selectedTask ? (
                    <div className="h-full flex flex-col">
                      {/* Task header */}
                      <div className="mb-3 pb-2 border-b border-slate-700">
                        <div className="text-xs text-gray-500 mb-1">Task:</div>
                        <div className="text-sm text-gray-300">{selectedTask.text}</div>
                      </div>

                      {/* Always editing interface */}
                      <div className="flex-1 flex flex-col">
                        <div className="text-xs text-gray-500 mb-2">
                          Notes (ESC to exit, Ctrl+Enter to save):
                        </div>
                        <textarea
                          ref={contextRef}
                          value={contextText}
                          onChange={(e) => setContextText(e.target.value)}
                          onBlur={handleSaveContext}
                          className="flex-1 w-full bg-slate-900 text-gray-300 px-2 py-1 outline-none border border-slate-600 resize-none text-sm"
                          placeholder="Add notes about this task..."
                          autoFocus
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-600 text-sm">
                      Select a task to edit notes
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Outliner View */
            <OutlinerView
              projects={projects}
              tasks={tasks}
              setTasks={setTasks}
              selectedProject={selectedProject}
              selectedProjectIdx={selectedProjectIdx}
              selectedTaskIdx={selectedTaskIdx}
              setSelectedProjectIdx={setSelectedProjectIdx}
              setSelectedTaskIdx={setSelectedTaskIdx}
              activePane={activePane}
              setActivePane={setActivePane}
              contextExpanded={contextExpanded}
              selectedTask={selectedTask}
              editingContext={editingContext}
              contextText={contextText}
              setContextText={setContextText}
              handleSaveContext={handleSaveContext}
              contextRef={contextRef}
              getPriorityLabel={getPriorityLabel}
              getPriorityColor={getPriorityColor}
              inputMode={inputMode}
              inputValue={inputValue}
              setInputValue={setInputValue}
              inputRef={inputRef}
              formatText={formatText}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-800 border-t border-slate-700 px-3 py-1">
        <div className="flex gap-3 text-xs text-gray-500">
          <span><span className="text-gray-400">Enter</span> edit notes</span>
          <span><span className="text-gray-400">b</span> bookmarks</span>
          <span><span className="text-gray-400">a</span> add</span>
          <span><span className="text-gray-400">x</span> toggle</span>
          <span><span className="text-gray-400">d</span> delete</span>
          <span><span className="text-gray-400">s</span> Todoist sync</span>
          <span><span className="text-gray-400">t</span> font toggle</span>
          <span><span className="text-gray-400">ESC</span> exit editor</span>
        </div>
      </div>
    </div>
  );
};

export default TUITaskManager;
