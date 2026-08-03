import { formatRupiah, parseRupiah } from '../money';

describe('formatRupiah', () => {
  it.each([
    [0, 'Rp 0'],
    [500, 'Rp 500'],
    [1_000, 'Rp 1.000'],
    [12_500, 'Rp 12.500'],
    [1_000_000, 'Rp 1.000.000'],
    [-45_000, '-Rp 45.000'],
  ])('%i → %s', (input, expected) => {
    expect(formatRupiah(input)).toBe(expected);
  });

  it('bisa tanpa awalan Rp', () => {
    expect(formatRupiah(12_500, { withPrefix: false })).toBe('12.500');
  });
});

describe('parseRupiah', () => {
  it.each([
    ['12500', 12_500],
    ['12.500', 12_500],
    ['Rp 12.500', 12_500],
    ['rp12500', 12_500],
    ['  45000  ', 45_000],
    ['12,5rb', 12_500],
    ['15k', 15_000],
    ['1,5jt', 1_500_000],
    ['2juta', 2_000_000],
  ])('membaca "%s" sebagai %i', (input, expected) => {
    expect(parseRupiah(input)).toBe(expected);
  });

  it.each([[''], ['   '], ['abc'], ['12abc'], ['-500'], ['.']])(
    'mengembalikan null untuk masukan tak terbaca: "%s"',
    (input) => {
      expect(parseRupiah(input)).toBeNull();
    },
  );

  it('membulatkan pecahan rupiah — nilai simpanan selalu bulat', () => {
    expect(parseRupiah('12.500,6')).toBe(12_501);
  });
});
