import { Injectable } from '@nestjs/common';

@Injectable()
export class AvatarsService {
  createSvg(
    name: string,
    width: number,
    height: number,
    background: string,
  ): string {
    const initials = this.getInitials(name);
    return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${background}" />
      <text x="50%" y="50%" alignment-baseline="central" text-anchor="middle"
        font-size="${width / 2}" dy=".35em" fill="white">${initials}</text>
    </svg>`;
  }

  getInitials(name: string): string {
    const initials = name
      .split(' ')
      .map((word) => word[0]?.toUpperCase())
      .join('');
    return initials.substring(0, 2);
  }
}
