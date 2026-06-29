function togglePassword() {
        const inp = document.getElementById("password");
        const closed = document.getElementById("eyeClosed");
        const open = document.getElementById("eyeOpen");
        const isHidden = inp.type === "password";
        inp.type = isHidden ? "text" : "password";
        closed.style.display = isHidden ? "none" : "block";
        open.style.display = isHidden ? "block" : "none";
      }

      function toggleForm(e) {
        e.preventDefault();
        const form = document.getElementById("signupForm");
        const title = document.querySelector(".form-title");
        const subtitle = document.querySelector(".form-subtitle");
        const btn = document.querySelector(".btn-create");
        const password = document.getElementById("password");
        const nextIsLogin = !form.classList.contains("auth-login");

        form.classList.toggle("auth-login", nextIsLogin);
        title.textContent = nextIsLogin ? "Welcome Back" : "Create an Account";
        subtitle.innerHTML = nextIsLogin
          ? 'New to Legacy Awards? <a href="#" onclick="toggleForm(event)">Create account</a>'
          : 'Already have an account? <a href="#" onclick="toggleForm(event)">Log in</a>';
        btn.textContent = nextIsLogin ? "Log In" : "Create Account";
        password.autocomplete = nextIsLogin ? "current-password" : "new-password";
      }

      function handleSubmit(e) {
        e.preventDefault();
        const form = document.getElementById("signupForm");
        const terms = document.getElementById("terms");
        const isLogin = form.classList.contains("auth-login");
        if (!isLogin && !terms.checked) {
          alert("Please accept the Terms & Conditions to continue.");
          return;
        }
        alert(isLogin ? "Welcome back to Legacy Awards." : "Account created successfully. Welcome to Legacy Awards.");
      }
