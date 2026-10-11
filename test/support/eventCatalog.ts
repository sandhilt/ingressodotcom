export function rioCatalog() {
  return [
    ...Array.from({ length: 180 }, (_, id) => ({ id: String(id), title: `Reexibição ${id}`, countIsPlaying: 2, synopsis: 'x'.repeat(5000) })),
    { id: 'a', title: 'Verity', countIsPlaying: 393 },
    { id: 'b', title: 'Se Eu Fosse Você 3', countIsPlaying: 397 },
    { id: 'c', title: 'Vingadores: Doutor Destino', countIsPlaying: 376, inPreSale: true },
  ];
}

