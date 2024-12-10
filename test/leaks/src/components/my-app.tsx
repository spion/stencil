import { Component, Host, h, Prop } from '@stencil/core';

@Component({
  tag: 'my-app',
  shadow: true,
})
export class MyApp {
  @Prop() showChild = true;
  render() {
    return (
      <Host class="my-app">
        {this.showChild ? <my-component>Nested</my-component> : "Bye world"}
      </Host>
    );
  }
}
