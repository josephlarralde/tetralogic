<script setup lang="ts">
import { shallowRef, useTemplateRef, onMounted } from 'vue'
import ThreeScene from '../utils/ThreeScene.ts'

const $container = useTemplateRef<HTMLDivElement>('glview')
const threeScene = shallowRef<ThreeScene | null>(null) // 

async function init() {
  if ($container.value) {
    threeScene.value = new ThreeScene($container.value)
    await threeScene.value.init()
    threeScene.value.animate()
  }
}

onMounted(() => {
  init().catch(console.error)
})

</script>

<template>
  <div id="glview" ref="glview"></div>
</template>

<style scoped>
#glview {
  /* margin: 0; */
  /* padding: 0; */
  width: 100%;
  height: 100%;
  display: flex;
  /* flex-direction: column; */
  /* flex: 1 1 auto; */

  /* ugly fix for three canvas bigger than container */
  /* overflow: hidden; */
}

#glview > canvas {
  flex: 1 1 auto;
}
</style>
