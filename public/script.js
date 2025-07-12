document.addEventListener('DOMContentLoaded', () => {
    // --- AUTHENTICATION (LOGIN/SIGNUP) PAGE LOGIC ---

    // Function to switch between Login and Signup forms
    window.showForm = (formId) => {
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active-form');
        });
        document.getElementById(formId).classList.add('active-form');

        document.querySelectorAll('.tab-link').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`show-${formId.replace('-form', '')}`).classList.add('active');
    };

    // Handle Login Form Submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const loginError = document.getElementById('login-error');

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();

                if (response.ok) {
                    loginError.textContent = result.message;
                    loginError.classList.remove('error-message');
                    loginError.classList.add('success-message', 'visible');
                    // Redirect to dashboard on successful login
                    setTimeout(() => {
                        window.location.href = result.redirect || '/dashboard.html';
                    }, 1000);
                } else {
                    loginError.textContent = result.message || 'Login failed.';
                    loginError.classList.remove('success-message');
                    loginError.classList.add('error-message', 'visible');
                }
            } catch (error) {
                console.error('Login request error:', error);
                loginError.textContent = 'An unexpected error occurred. Please try again.';
                loginError.classList.remove('success-message');
                loginError.classList.add('error-message', 'visible');
            } finally {
                 setTimeout(() => { // Hide message after some time
                    loginError.classList.remove('visible');
                    loginError.textContent = '';
                }, 5000);
            }
        });
    }

    // Handle Signup Form Submission
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const signupError = document.getElementById('signup-error');

            try {
                const response = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const result = await response.json();

                if (response.ok) {
                    signupError.textContent = result.message;
                    signupError.classList.remove('error-message');
                    signupError.classList.add('success-message', 'visible');
                    // Redirect to dashboard on successful signup
                    setTimeout(() => {
                        window.location.href = result.redirect || '/dashboard.html';
                    }, 1000);
                } else {
                    signupError.textContent = result.message || 'Signup failed.';
                    signupError.classList.remove('success-message');
                    signupError.classList.add('error-message', 'visible');
                }
            } catch (error) {
                console.error('Signup request error:', error);
                signupError.textContent = 'An unexpected error occurred. Please try again.';
                signupError.classList.remove('success-message');
                signupError.classList.add('error-message', 'visible');
            } finally {
                 setTimeout(() => { // Hide message after some time
                    signupError.classList.remove('visible');
                    signupError.textContent = '';
                }, 5000);
            }
        });
    }

    // Handle Forgot Password Form Submission
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value;
            const forgotMessage = document.getElementById('forgot-message');

            try {
                const response = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const result = await response.json();

                if (response.ok) {
                    forgotMessage.textContent = result.message;
                    forgotMessage.classList.remove('error-message');
                    forgotMessage.classList.add('success-message', 'visible');
                } else {
                    forgotMessage.textContent = result.message || 'Failed to send reset link.';
                    forgotMessage.classList.remove('success-message');
                    forgotMessage.classList.add('error-message', 'visible');
                }
            } catch (error) {
                console.error('Forgot password request error:', error);
                forgotMessage.textContent = 'An unexpected error occurred. Please try again.';
                forgotMessage.classList.remove('success-message');
                forgotMessage.classList.add('error-message', 'visible');
            } finally {
                setTimeout(() => { // Hide message after some time
                    forgotMessage.classList.remove('visible');
                    forgotMessage.textContent = '';
                }, 5000);
            }
        });
    }


    // --- DASHBOARD PAGE LOGIC ---

    // Function to fetch and display files
    const loadFiles = async () => {
        const fileList = document.getElementById('file-list');
        if (!fileList) return; // Exit if not on dashboard page

        try {
            const response = await fetch('/api/files');
            const data = await response.json();

            fileList.innerHTML = ''; // Clear the list first
            if (data.success && data.files.length > 0) {
                data.files.forEach(filename => {
                    const li = document.createElement('li');
                    li.className = 'file-item';
                    li.innerHTML = `
                        <span>${filename}</span>
                        <button class="delete-btn" data-filename="${filename}">Delete</button>
                    `;
                    fileList.appendChild(li);
                });
            } else {
                fileList.innerHTML = '<li>No files uploaded yet.</li>';
            }
        } catch (error) {
            fileList.innerHTML = '<li>Error loading files.</li>';
        }
    };

    // --- Event Handlers for Dashboard ---
    const uploadForm = document.getElementById('upload-form');
    if (uploadForm) {
        const fileInput = document.getElementById('file-input');
        const fileNameDisplay = document.getElementById('file-name-display');

        fileInput.addEventListener('change', () => {
            fileNameDisplay.textContent = fileInput.files.length > 0 ? fileInput.files[0].name : 'No file selected';
        });

        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(uploadForm);

            try {
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (response.ok) {
                    loadFiles(); // Refresh the file list on successful upload
                    uploadForm.reset(); // Clear the form
                    fileNameDisplay.textContent = 'No file selected';
                } else {
                    alert(result.message || 'Upload failed.');
                }
            } catch (error) {
                alert('An error occurred during upload.');
            }
        });
    }

    // Event delegation for delete buttons
    const fileListContainer = document.getElementById('file-list');
    if(fileListContainer) {
        fileListContainer.addEventListener('click', async (e) => {
            if (e.target && e.target.classList.contains('delete-btn')) {
                const filename = e.target.dataset.filename;
                if (confirm(`Are you sure you want to delete ${filename}?`)) {
                    try {
                        const response = await fetch('/api/delete-file', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename })
                        });
                        const result = await response.json();
                        if(response.ok) {
                            loadFiles(); // Refresh list on successful delete
                        } else {
                            alert(result.message || 'Failed to delete file.');
                        }
                    } catch (error) {
                         alert('An error occurred while deleting the file.');
                    }
                }
            }
        });
    }

    // Handler for the "Ask Sortir" form
    const askForm = document.getElementById('ask-form');
    if (askForm) {
        askForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const question = document.getElementById('question-input').value;
            const answerContainer = document.getElementById('answer-container');
            answerContainer.innerHTML = '<p>Thinking...</p>';

            try {
                const response = await fetch('/api/ask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question })
                });
                const result = await response.json();
                if(result.success) {
                    answerContainer.innerHTML = `<p>${result.answer}</p>`;
                } else {
                    answerContainer.innerHTML = `<p class="error-text">${result.message || 'Failed to get an answer.'}</p>`;
                }
            } catch (error) {
                answerContainer.innerHTML = `<p class="error-text">An error occurred.</p>`;
            }
        });
    }

    // Handler for logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/logout');
                const result = await response.json();
                if (response.ok) {
                    window.location.href = '/'; // Redirect to home/login page
                } else {
                    alert(result.message || 'Failed to log out.');
                }
            } catch (error) {
                alert('An error occurred during logout.');
            }
        });
    }


    // Initial load of files when the dashboard page loads
    // Check for the specific dashboard.html path OR if a dashboard element exists
    if (window.location.pathname.endsWith('dashboard.html') || document.querySelector('.dashboard-container')) {
        loadFiles();
    }
}); // End of DOMContentLoaded
