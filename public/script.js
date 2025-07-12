document.addEventListener('DOMContentLoaded', () => {
    // --- Global Helper Functions ---
    const showMessage = (element, message, isError = true) => {
        element.textContent = message;
        element.className = isError ? 'error-message visible' : 'success-message visible';
    };

    const handleFormSubmit = async (form, apiPath, successCallback) => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            const errorElement = form.querySelector('.error-message, .message');
            
            try {
                const response = await fetch(apiPath, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                
                if (response.ok) {
                    successCallback(result);
                } else {
                    if (errorElement) showMessage(errorElement, result.message || 'An unknown error occurred.', true);
                }
            } catch (err) {
                if (errorElement) showMessage(errorElement, 'Network error. Please try again.', true);
            }
        });
    };

    // --- Tab Switching for Login/Signup Page ---
    window.showForm = (formId) => {
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active-form'));
        document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));

        document.getElementById(formId).classList.add('active-form');
        if (formId === 'login-form') {
            document.getElementById('show-login').classList.add('active');
        } else {
            document.getElementById('show-signup').classList.add('active');
        }
    };

    // --- Form Handlers ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        handleFormSubmit(loginForm, '/api/login', (data) => {
            window.location.href = '/dashboard.html'; // Redirect to dashboard on success
        });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        handleFormSubmit(signupForm, '/api/signup', (data) => {
            window.location.href = '/dashboard.html'; // Redirect to dashboard on success
        });
    }

    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
        const messageEl = document.getElementById('forgot-message');
        handleFormSubmit(forgotForm, '/api/forgot-password', (data) => {
            showMessage(messageEl, data.message, false);
            forgotForm.reset();
        });
    }

    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        const messageEl = document.getElementById('reset-message');
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email');
        const token = urlParams.get('token');

        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new-password').value;

            try {
                const response = await fetch('/api/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, token, newPassword })
                });
                const result = await response.json();

                if (response.ok) {
                    showMessage(messageEl, result.message, false);
                    resetForm.style.display = 'none'; // Hide form on success
                    setTimeout(() => window.location.href = '/', 3000); // Redirect to login after 3s
                } else {
                    showMessage(messageEl, result.message, true);
                }
            } catch (err) {
                 showMessage(messageEl, 'Network error. Please try again.', true);
            }
        });
    }
    
    // Check if on dashboard and attach logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
             const response = await fetch('/api/logout', { method: 'POST'});
             if(response.ok) {
                 window.location.href = '/';
             } else {
                 alert('Logout failed.');
             }
        });
    }
});
