import React, { useState, useEffect, useRef } from 'react';

const TUITaskManager = () => {
  const [projects, setProjects] = useState([
    { id: 1, name: 'Inbox', color: 'blue' },
    { id: 2, name: 'Work', color: 'red' },
    { id: 3, name: 'Personal', color: 'green' },
  ]);
  
  const [tasks, setTasks] = useState([
    { id: 1, projectId: 1, text: 'Review project proposal', completed: false, priority: 1, notes: '' },
    { id: 2, projectId: 1, text: 'Update documentation', completed: false, priority: 2, notes: '' },
    { id: 3, projectId: 2, text: 'Fix bug in authentication', completed: true, priority: 1, notes: 'Issue with JWT token validation' },
    { id: 4, projectId: 2, text: 'Prepare presentation', completed: false, priority: 3, notes: '' },
    { id: 5, projectId: 3, text: 'Buy groceries', completed: false, priority: 2, notes: '' },
  ]);

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
  const inputRef = useRef(null);
  const contextRef = useRef(null);

  const selectedProject = projects[selectedProjectIdx];
  const filteredTasks = tasks.filter(t => t.projectId === selectedProject?.id);
  const selectedTask = filteredTasks[selectedTaskIdx];

  const handleSaveContext = () => {
    if (selectedTask) {
      setTasks(tasks.map(t => 
        t.id === selectedTask.id ? { ...t, notes: contextText } : t
      ));
    }
    setEditingContext(false);
    setContextText('');
  };

  const extractUrls = (text) => {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  };

  const currentBookmarks = selectedTask ? extractUrls(selectedTask.notes) : [];

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
    }
  }, [inputMode, editingContext]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (inputMode) {
        if (e.key === 'Escape') {
          setInputMode(false);
          setInputValue('');
          if (contextExpanded) {
            setContextExpanded(false);
          }
        } else if (e.key === 'Enter' && inputValue.trim()) {
          if (activePane === 'projects') {
            const newProject = {
              id: Date.now(),
              name: inputValue,
              color: ['blue', 'red', 'green', 'yellow', 'purple'][Math.floor(Math.random() * 5)]
            };
            setProjects([...projects, newProject]);
          } else if (activePane === 'tasks') {
            const newTask = {
              id: Date.now(),
              projectId: selectedProject.id,
              text: inputValue,
              completed: false,
              priority: 2,
              notes: ''
            };
            setTasks([...tasks, newTask]);
          }
          setInputValue('');
          setInputMode(false);
        }
        return;
      }

      if (editingContext) {
        if (e.key === 'Escape') {
          setEditingContext(false);
          setContextText('');
        }
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
          e.preventDefault();
          if (activePane === 'tasks') setActivePane('projects');
          else if (activePane === 'context') setActivePane('tasks');
          break;
        case 'l':
          e.preventDefault();
          if (activePane === 'projects') setActivePane('tasks');
          else if (activePane === 'tasks') setActivePane('context');
          break;
        case 'j':
          e.preventDefault();
          if (activePane === 'projects') {
            setSelectedProjectIdx(Math.min(projects.length - 1, selectedProjectIdx + 1));
          } else if (activePane === 'tasks') {
            setSelectedTaskIdx(Math.min(filteredTasks.length - 1, selectedTaskIdx + 1));
          }
          break;
        case 'k':
          e.preventDefault();
          if (activePane === 'projects') {
            setSelectedProjectIdx(Math.max(0, selectedProjectIdx - 1));
          } else if (activePane === 'tasks') {
            setSelectedTaskIdx(Math.max(0, selectedTaskIdx - 1));
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (activePane === 'tasks' && selectedTask && !contextExpanded) {
            setContextExpanded(true);
            setActivePane('context');
          } else if (activePane === 'context' && !editingContext) {
            setEditingContext(true);
            setContextText(selectedTask?.notes || '');
          }
          break;
        case 'Escape':
          e.preventDefault();
          if (contextExpanded) {
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
            setTasks(tasks.map(t => 
              t.id === selectedTask.id ? { ...t, completed: !t.completed } : t
            ));
          }
          break;
        case 'd':
          e.preventDefault();
          if (activePane === 'tasks' && selectedTask) {
            setTasks(tasks.filter(t => t.id !== selectedTask.id));
            setSelectedTaskIdx(Math.max(0, selectedTaskIdx - 1));
          } else if (activePane === 'projects' && projects.length > 1) {
            setProjects(projects.filter((_, idx) => idx !== selectedProjectIdx));
            setSelectedProjectIdx(Math.max(0, selectedProjectIdx - 1));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const handleSaveContext = () => {
    if (selectedTask) {
      setTasks(tasks.map(t => 
        t.id === selectedTask.id ? { ...t, notes: contextText } : t
      ));
    }
    setEditingContext(false);
    setContextText('');
  };

  return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePane, selectedProjectIdx, selectedTaskIdx, projects, tasks, inputMode, inputValue, selectedProject, filteredTasks, selectedTask, contextExpanded, editingContext]);

  useEffect(() => {
    if (selectedTaskIdx >= filteredTasks.length) {
      setSelectedTaskIdx(Math.max(0, filteredTasks.length - 1));
    }
  }, [filteredTasks.length, selectedTaskIdx]);

  const getPriorityLabel = (priority) => {
    const labels = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' };
    return labels[priority] || 'P2';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      1: 'text-red-400',
      2: 'text-yellow-400',
      3: 'text-blue-400',
      4: 'text-gray-500'
    };
    return colors[priority] || 'text-gray-500';
  };

  return (
    <div className="h-screen bg-slate-900 text-gray-300 font-mono flex flex-col text-sm">
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
              {currentBookmarks.map((url, idx) => (
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

        {/* Tasks and Context panes */}
        <div className="flex-1 flex flex-col">
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

          {/* Context pane */}
          <div className={`${contextExpanded ? 'flex-1' : 'h-40'} flex flex-col border-t border-slate-700`}>
            <div className="bg-slate-800 px-3 py-1.5 border-b border-slate-700">
              <span className="text-xs uppercase tracking-wide text-gray-400">Context</span>
            </div>
            <div className={`flex-1 overflow-y-auto px-3 py-2 ${
              activePane === 'context' ? 'bg-slate-800' : 'bg-slate-900'
            }`}>
              {selectedTask ? (
                editingContext ? (
                  <div className="h-full flex flex-col">
                    <div className="text-xs text-gray-500 mb-2">Editing notes (ESC to cancel):</div>
                    <textarea
                      ref={contextRef}
                      value={contextText}
                      onChange={(e) => setContextText(e.target.value)}
                      onBlur={handleSaveContext}
                      className="flex-1 w-full bg-slate-900 text-gray-300 px-2 py-1 outline-none border border-slate-600 resize-none font-mono text-xs"
                      placeholder="Add notes about this task..."
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-gray-500">Task:</span> <span>{selectedTask.text}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>{' '}
                      <span className={selectedTask.completed ? 'text-green-400' : 'text-yellow-400'}>
                        {selectedTask.completed ? 'Completed' : 'Active'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Priority:</span>{' '}
                      <span className={getPriorityColor(selectedTask.priority)}>
                        {getPriorityLabel(selectedTask.priority)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Project:</span> <span>{selectedProject?.name}</span>
                    </div>
                    {selectedTask.notes && (
                      <div className="mt-3 pt-2 border-t border-slate-700">
                        <div className="text-gray-500 mb-1">Notes:</div>
                        <div className="text-gray-300 whitespace-pre-wrap">{selectedTask.notes}</div>
                      </div>
                    )}
                    {!selectedTask.notes && (
                      <div className="mt-3 pt-2 border-t border-slate-700 text-gray-600">
                        Press 'i' or Enter to add notes
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="text-gray-600 text-xs">
                  Select a task to view details
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-800 border-t border-slate-700 px-3 py-1">
        <div className="flex gap-3 text-xs text-gray-500">
          <span><span className="text-gray-400">Enter</span> {activePane === 'context' ? 'edit' : 'expand'}</span>
          <span><span className="text-gray-400">i</span> edit notes</span>
          <span><span className="text-gray-400">b</span> bookmarks</span>
          <span><span className="text-gray-400">a</span> add</span>
          <span><span className="text-gray-400">x</span> toggle</span>
          <span><span className="text-gray-400">d</span> delete</span>
          <span><span className="text-gray-400">ESC</span> {contextExpanded ? 'collapse' : 'cancel'}</span>
        </div>
      </div>
    </div>
  );
};

export default TUITaskManager;