<script setup lang="ts">
import TetraLogic from './components/TetraLogic.vue'
</script>

<template>
  <div id="wrapper">
    <TetraLogic />
  </div>
</template>

<style scoped>
#wrapper {
  pointer-events: all;
  z-index: 1;
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;  
}
</style>