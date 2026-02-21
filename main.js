const root = document.documentElement;

document.addEventListener("mousemove", (e) => {
  const x = (e.clientX / window.innerWidth) * 100;
  const y = (e.clientY / window.innerHeight) * 100;

  root.style.setProperty('--mouse-x', `${x}%`);
  root.style.setProperty('--mouse-y', `${y}%`);
});

/* Subtle parallax depth */
const layer1 = document.querySelector('.layer-1');
const layer2 = document.querySelector('.layer-2');

document.addEventListener("mousemove", (e) => {
  const moveX = (e.clientX - window.innerWidth / 2) / 50;
  const moveY = (e.clientY - window.innerHeight / 2) / 50;

  layer1.style.transform = `translate(${moveX}px, ${moveY}px)`;
  layer2.style.transform = `translate(${moveX * 1.5}px, ${moveY * 1.5}px)`;
});
