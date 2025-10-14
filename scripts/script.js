document.querySelector("#copy-email").addEventListener("click", copyLink("#copy-email", "#email-link"));
document.querySelector("#copy-github").addEventListener("click", copyLink("#copy-github", "#github-link"));
document.querySelector("#copy-linkedin").addEventListener("click", copyLink("#copy-linkedin", "#linkedin-link"));

function copyLink(buttonId, linkId) {
    document.querySelector(buttonId).addEventListener("click", function(e) {
        e.preventDefault();
        const content = document.querySelector(linkId).textContent;
        navigator.clipboard.writeText(content);
        document.querySelector(buttonId).innerHTML = `<span class="material-symbols-outlined">check</span>`;
        setTimeout(() => {
            document.querySelector(buttonId).innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
        }, 1500);
    });
}