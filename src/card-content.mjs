/** All authored card copy, including structured content, participates in checks. */
export function cardTextParts(card = {}) {
  return [card.title, card.body, card.badge, card.note,
    ...Object.values(card.metric ?? {}),
    ...(card.items ?? []).flatMap(item => [item.label, item.value, item.unit, item.detail]),
  ].filter(value => value !== undefined && value !== null && String(value).trim()).map(String);
}

export function cardHasContent(card = {}) {
  return cardTextParts({ ...card, title: '', badge: '' }).length > 0;
}
