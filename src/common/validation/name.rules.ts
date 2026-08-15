export const NAME_MAX_LENGTH = 255;

// eslint-disable-next-line no-control-regex
export const NAME_PATTERN = /^[^/\\\x00-\x1f]+$/;

export const NAME_PATTERN_MESSAGE = 'name must not contain slashes or control characters';
