import { Injectable } from '@nestjs/common';

export interface NameConflictOptions {
  splitExtension: boolean;
}

interface NameParts {
  base: string;
  extension: string;
}

@Injectable()
export class NameConflictService {
  private static readonly SUFFIX_PATTERN = /^(.*) \((\d+)\)$/;

  resolve(desiredName: string, takenNames: Iterable<string>, options: NameConflictOptions): string {
    const taken = new Set(takenNames);

    if (!taken.has(desiredName)) {
      return desiredName;
    }

    const { base, extension } = this.split(desiredName, options);
    const usedSuffixes = new Set<number>();

    for (const name of taken) {
      const parts = this.split(name, options);

      if (parts.extension !== extension) {
        continue;
      }

      const match = NameConflictService.SUFFIX_PATTERN.exec(parts.base);

      if (match && match[1] === base) {
        usedSuffixes.add(Number(match[2]));
      }
    }

    let suffix = 1;
    while (usedSuffixes.has(suffix)) {
      suffix += 1;
    }

    return `${base} (${suffix})${extension}`;
  }

  buildLikePattern(desiredName: string, options: NameConflictOptions): string {
    const { base, extension } = this.split(desiredName, options);

    return `${this.escapeLike(base)}%${this.escapeLike(extension)}`;
  }

  private split(name: string, options: NameConflictOptions): NameParts {
    if (!options.splitExtension) {
      return { base: name, extension: '' };
    }

    const dot = name.lastIndexOf('.');

    if (dot <= 0 || dot === name.length - 1) {
      return { base: name, extension: '' };
    }

    return { base: name.slice(0, dot), extension: name.slice(dot) };
  }

  private escapeLike(value: string): string {
    return value.replace(/([\\%_])/g, '\\$1');
  }
}
