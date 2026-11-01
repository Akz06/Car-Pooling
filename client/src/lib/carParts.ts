import { getModel, type CarModel, type Interior, type Paint } from '@shared/catalog';
import type { Car } from '@shared/types';

export function resolveCar(car: Car): { model: CarModel; paint: Paint; interior: Interior } {
  const model = getModel(car.modelId)!;
  return {
    model,
    paint: model.paints.find((p) => p.id === car.paintId) ?? model.paints[0],
    interior: model.interiors.find((i) => i.id === car.interiorId) ?? model.interiors[0],
  };
}

export const carTitle = (m: CarModel) => `${m.make} ${m.model}`;
