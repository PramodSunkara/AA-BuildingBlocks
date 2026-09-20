// Box-model parameters per species. Sizes in 1/16 block units.
export const SPECIES = {
  chicken: { body: [6, 6, 8], head: [4, 5, 4], legs: { n: 2, w: 1, h: 4 }, base: '#F2F2F2', second: '#F2C230', accent: '#D9403A', pattern: 'plain', extras: ['beak', 'comb', 'wings'], speed: 1.2, hop: true, sound: 'chicken', name: 'Chicken' },
  cow: { body: [10, 10, 16], head: [8, 8, 6], legs: { n: 4, w: 3, h: 6 }, base: '#F2F2F2', second: '#2A2A2A', accent: '#F08AB8', pattern: 'patches', extras: ['horns', 'tail'], speed: 0.8, hop: false, sound: 'cow', name: 'Cow' },
  pig: { body: [8, 8, 12], head: [7, 7, 5], legs: { n: 4, w: 3, h: 4 }, base: '#F4A6C0', second: '#E07A9A', accent: '#2A2A2A', pattern: 'plain', extras: ['snout', 'tail'], speed: 1.0, hop: false, sound: 'pig', name: 'Pig' },
  sheep: { body: [9, 9, 13], head: [6, 6, 5], legs: { n: 4, w: 2, h: 5 }, base: '#F2F2F2', second: '#3A3A3A', accent: '#2A2A2A', pattern: 'fluffy', extras: [], speed: 0.9, hop: false, sound: 'sheep', name: 'Sheep', darkHead: true },
  dog: { body: [6, 6, 11], head: [6, 6, 6], legs: { n: 4, w: 2, h: 5 }, base: '#9C6B3C', second: '#E8D2B0', accent: '#2A2A2A', pattern: 'belly', extras: ['ears', 'tail'], speed: 1.6, hop: false, sound: 'dog', name: 'Dog' },
  cat: { body: [5, 5, 10], head: [5, 5, 5], legs: { n: 4, w: 2, h: 4 }, base: '#F08A2A', second: '#C96E1A', accent: '#2A2A2A', pattern: 'stripes', extras: ['ears', 'tail'], speed: 1.4, hop: false, sound: 'cat', name: 'Cat' },
  horse: { body: [10, 11, 18], head: [6, 7, 8], legs: { n: 4, w: 3, h: 10 }, base: '#7A4B2A', second: '#2A2A2A', accent: '#2A2A2A', pattern: 'plain', extras: ['mane', 'tail'], speed: 2.0, hop: false, sound: 'horse', name: 'Horse' },
  rabbit: { body: [4, 4, 7], head: [4, 4, 4], legs: { n: 4, w: 1, h: 2 }, base: '#D8D8D8', second: '#F08AB8', accent: '#2A2A2A', pattern: 'plain', extras: ['longears', 'tail'], speed: 1.5, hop: true, sound: 'rabbit', name: 'Rabbit' },
};
