export function mount() {
    const modalButtons = document.querySelectorAll("[data-afx-modal]");
    const closeButtons = document.querySelectorAll("[data-afx-close]");
    let activeModal = null;

    function openModal(modalId) {
      const modal = document.getElementById(modalId);

      if (!modal) return;

      activeModal = modal;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("afx-modal-open");

      const closeButton = modal.querySelector(".afx-modal__close");

      if (closeButton) {
        setTimeout(function () {
          closeButton.focus();
        }, 50);
      }
    }

    function closeModal(modal) {
      if (!modal) return;

      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("afx-modal-open");
      activeModal = null;
    }

    modalButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        openModal(button.getAttribute("data-afx-modal"));
      });
    });

    closeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        closeModal(button.closest(".afx-modal"));
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && activeModal) {
        closeModal(activeModal);
      }
    });
  }
