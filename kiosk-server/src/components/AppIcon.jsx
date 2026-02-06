function AppIcon({ icon, className }) {
  if (icon?.startsWith('/')) {
    return <img src={icon} alt="" className={className} draggable={false} />;
  }
  return <span className={`inline-flex items-center justify-center leading-none ${className}`}>{icon}</span>;
}

export default AppIcon;
