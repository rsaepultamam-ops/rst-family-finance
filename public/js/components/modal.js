/**
 * RST Family Finance - Modal Dialog Manager
 */

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// Global click handler to close modals on backdrop or cancel click
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop.id);
      }
    });

    const closeBtn = backdrop.querySelector('.btn-close-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(backdrop.id));
    }

    const cancelBtn = backdrop.querySelector('.btn-cancel-modal');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => closeModal(backdrop.id));
    }
  });
});

window.openModal = openModal;
window.closeModal = closeModal;
