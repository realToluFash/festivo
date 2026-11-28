package expo.modules.screenbrightness

import android.view.WindowManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The app's own window at full brightness, then back to the system's: the person's setting is never written. */
class ScreenBrightnessModule : Module() {
  private fun set(brightness: Float) {
    val window = appContext.currentActivity?.window ?: return
    window.attributes = window.attributes.apply { screenBrightness = brightness }
  }

  override fun definition() = ModuleDefinition {
    Name("ScreenBrightness")

    AsyncFunction("raise") {
      set(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("restore") {
      set(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE)
    }.runOnQueue(Queues.MAIN)
  }
}
