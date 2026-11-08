package expo.modules.boldtext

import android.content.ComponentCallbacks
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Android's Bold text, read from the application: the activity keeps its own adjustment at zero, so the app draws the heavier faces itself. */
class BoldTextModule : Module() {
  private var application: Context? = null
  private var last = false

  private val changes = object : ComponentCallbacks {
    override fun onConfigurationChanged(newConfig: Configuration) {
      val now = isOn(newConfig)
      if (now == last) return
      last = now
      sendEvent("onChange", mapOf("on" to now))
    }

    override fun onLowMemory() = Unit
  }

  private fun isOn(config: Configuration): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      config.fontWeightAdjustment != Configuration.FONT_WEIGHT_ADJUSTMENT_UNDEFINED &&
      config.fontWeightAdjustment > 0

  override fun definition() = ModuleDefinition {
    Name("BoldText")

    Events("onChange")

    OnCreate {
      val context = appContext.reactContext?.applicationContext ?: return@OnCreate
      application = context
      last = isOn(context.resources.configuration)
      context.registerComponentCallbacks(changes)
    }

    OnDestroy {
      application?.unregisterComponentCallbacks(changes)
      application = null
    }

    Function("isOn") {
      val context = application ?: return@Function false
      last = isOn(context.resources.configuration)
      last
    }
  }
}
