import React from 'react';

export function DocumentTitleOverride(props: { title: React.ReactNode }) {
  return <span hidden data-document-title-override>{props.title}</span>;
}
