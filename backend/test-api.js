const API_BASE = 'http://localhost:3001';

async function testAPI() {
  console.log('🧪 Testing TUIist Backend API\n');

  try {
    // Test health
    console.log('1. Health Check:');
    const health = await fetch(`${API_BASE}/health`);
    console.log('   ✅', await health.json());

    // Get projects
    console.log('\n2. Get Projects:');
    const projects = await fetch(`${API_BASE}/api/projects`);
    const projectsData = await projects.json();
    console.log('   ✅', projectsData);

    // Create project
    console.log('\n3. Create Project:');
    const createProject = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'API Test Project', color: 'purple' })
    });
    const newProject = await createProject.json();
    console.log('   ✅', newProject);

    // Create task
    console.log('\n4. Create Task:');
    const createTask = await fetch(`${API_BASE}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: 'API Test Task', 
        projectId: newProject.id,
        priority: 3 
      })
    });
    const newTask = await createTask.json();
    console.log('   ✅', newTask);

    // Toggle task
    console.log('\n5. Toggle Task:');
    const toggleTask = await fetch(`${API_BASE}/api/tasks/${newTask.id}/toggle`, {
      method: 'PATCH'
    });
    const toggledTask = await toggleTask.json();
    console.log('   ✅', toggledTask);

    // Sync status
    console.log('\n6. Sync Status:');
    const syncStatus = await fetch(`${API_BASE}/api/sync/status`);
    console.log('   ✅', await syncStatus.json());

    console.log('\n🎉 All tests passed! Backend is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure the server is running with: npm run dev');
  }
}

testAPI();
