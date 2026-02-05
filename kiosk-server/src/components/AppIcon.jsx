function AppIcon({ icon, className }) {
  if (icon?.startsWith('/')) {
    return <img src={icon} alt="" className={className} draggable={false} />;
  }
  return <span className={className}>{icon}</span>;
}

export default AppIcon;
