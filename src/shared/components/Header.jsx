import logoVideplast from '../../assets/videplast-brand.png';

const Header = () => (
  <header className="app-header flex-column text-center">
    <img src={logoVideplast} alt="Videplast" className="logo" />
    <span className="vp-micro-label mt-2 mb-0">VisionStock · Inventário de Almoxarifado</span>
  </header>
);

export default Header;
