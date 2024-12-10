import { Component, Host, h, Prop } from '@stencil/core';

@Component({
  tag: 'my-component',
  shadow: true,
})
export class MyComponent {
  @Prop() text = "Hello World";

  render() {
    return (
      <Host>
        <div>
          <slot></slot>
        </div>
        {this.text}
      </Host>
    );
  }
}
