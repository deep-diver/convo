// navigation.js

export let isTraditionalLayout = false;

export function updateLayout() {
  const carousel = document.getElementById('carousel');
  const carouselWrapper = document.getElementById('carouselWrapper');
  const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (isTraditionalLayout) {
    carousel.classList.add('traditional');
    carouselWrapper.classList.add('traditional-mode');
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    toggleLayoutBtn.innerHTML = `<img src="assets/vertical.svg" alt="Icon" class="svg-icon">`;
  } else {
    carousel.classList.remove('traditional');
    carouselWrapper.classList.remove('traditional-mode');
    prevBtn.style.display = '';
    nextBtn.style.display = '';
    toggleLayoutBtn.innerHTML = `<img src="assets/horizontal.svg" alt="Icon" class="svg-icon">`;
  }
}

export function updateHamburgerPosition() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const newSessionBtn = document.getElementById('newSessionBtn');
  const toggleLayoutBtn = document.getElementById('toggleLayoutBtn');
  const navBar = document.getElementById('navBar');
  const navHeader = navBar.querySelector('.nav-header');
  const headerLeft = document.getElementById('headerLeft');
  if (navBar.classList.contains('hidden')) {
    headerLeft.appendChild(hamburgerBtn);
    headerLeft.appendChild(newSessionBtn);
    headerLeft.appendChild(toggleLayoutBtn);
  } else {
    navHeader.appendChild(hamburgerBtn);
    navHeader.appendChild(newSessionBtn);
    navHeader.appendChild(toggleLayoutBtn);
  }
}

export function toggleLayout() {
  isTraditionalLayout = !isTraditionalLayout;
  updateLayout();
}
