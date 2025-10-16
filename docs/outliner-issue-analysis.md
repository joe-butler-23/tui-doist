# Outliner Drag Reordering Root Cause

The regression that caused drag-and-drop reordering to "snap back" in the outliner came from mutating a filtered copy of the tasks array without writing the reordered results back into the source list. In the original handler we called `tasks.filter(...)` to gather the project-local tasks and then ran `projectTasks.splice(...)` to overwrite the subset. Because `Array.prototype.filter` returns a brand-new array, the splice mutated only that temporary copy—the `tasks` array that React keeps in state never saw the new order, so the next render reverted to the previous ordering.

The fix rebuilds the per-project slice immutably inside the `setTasks` functional update and then stitches the reordered tasks back into the full list before returning it. That ensures the outliner (and every other consumer of the shared `tasks` state) receives the correct ordering on the very next render.
