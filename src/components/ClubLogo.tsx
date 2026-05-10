interface ClubLogoProps {
  logoUrl: string | null;
  primary: string;
  secondary: string;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
}

export function ClubLogo({ logoUrl, primary, secondary, size = 'md', alt }: ClubLogoProps) {
  const px = size === 'sm' ? 22 : size === 'lg' ? 56 : 32;
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={alt ?? ''}
        className="club-logo"
        width={px}
        height={px}
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
        }}
      />
    );
  }
  return (
    <span className="club-logo club-logo--swatches" style={{ width: px, height: px }}>
      <span style={{ background: primary, width: px / 2, height: px }} />
      <span style={{ background: secondary, width: px / 2, height: px }} />
    </span>
  );
}
