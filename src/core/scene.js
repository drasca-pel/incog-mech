// The scene is everything drawn in a project: a list of items.
// Functions here never change the old scene, they return a new one. That is what makes undo easy.
export const emptyScene = () => ({ items: [], nextId: 1 });

export function addItem(scene, item) {
  const id = scene.nextId;
  return { scene: { items: [...scene.items, { ...item, id }], nextId: id + 1 }, id };
}

export const updateItem = (scene, id, fn) => ({
  ...scene,
  items: scene.items.map((i) => (i.id === id ? fn(i) : i)),
});

export const removeItem = (scene, id) => ({
  ...scene,
  items: scene.items.filter((i) => i.id !== id),
});