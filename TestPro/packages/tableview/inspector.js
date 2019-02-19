'use strict';

Vue.component('tableView-inspector', {
  template: `
    <ui-prop v-prop="target.cellPrefab"></ui-prop>
    <ui-prop v-prop="target.content"></ui-prop>
    <ui-prop v-prop="target.detailNode"></ui-prop>

    <ui-prop v-prop="target.horizontalScrollBar" v-show="!target.direction.value"></ui-prop>
    <ui-prop v-prop="target.verticalScrollBar" v-show="target.direction.value"></ui-prop>
    <ui-prop v-prop="target.direction"></ui-prop>
    
    <ui-prop v-prop="target.brake" v-show="target.inertia.value"></ui-prop>
    
    <ui-prop v-prop="target.elastic"></ui-prop>
    <ui-prop v-prop="target.bounceDuration" v-show="target.elastic.value"></ui-prop>
     
  `,

  compiled() {
    // console.log(this.target.viewType)
  },
  props: {
    target: {
      twoWay: true,
      type: Object,
    },
  },
});